import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL        = 'deepseek-chat';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    return process.env.DEEPSEEK_API_KEY ?? '';
  }

  // ── Основной чат ──────────────────────────────────────────

  async chat(
    userMessage: string,
    context?: {
      city?:        string;
      specialists?: any[];
      history?:     any[];
    },
  ): Promise<{ text: string; specialists?: any[] }> {

    const specs = context?.specialists?.slice(0, 6) ?? [];
    const specsContext = specs.length > 0
      ? '\n\nСпециалисты в базе:\n' + specs
          .map(s => `- ${s.user?.name ?? s.name}: ${s.bio?.slice(0, 80) ?? ''}, от ${s.priceFrom ?? '?'}₸, рейтинг ${Number(s.rating ?? 0).toFixed(1)}`)
          .join('\n')
      : '';

    const systemPrompt = `Ты AI-помощник маркетплейса услуг "Мастер" в Казахстане (${context?.city ?? 'Алматы'}).
Помогаешь клиентам найти специалистов, отвечаешь на вопросы об услугах и ценах.
Отвечай по-русски, дружелюбно и конкретно. 2-4 предложения.
Если пользователь описывает задачу — предложи подходящих специалистов из списка.${specsContext}`;

    const cleanHistory = (context?.history ?? [])
      .filter((m: any) =>
        m?.role && m?.content &&
        ['user', 'assistant'].includes(m.role) &&
        String(m.content).trim().length > 0
      )
      .slice(-6)
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...cleanHistory,
      { role: 'user',   content: userMessage },
    ];

    try {
      const response = await axios.post(
        DEEPSEEK_URL,
        { model: MODEL, messages, max_tokens: 500, temperature: 0.7 },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type':  'application/json',
          },
          timeout: 30000,
        },
      );

      const text = response.data.choices[0]?.message?.content ?? 'Не удалось получить ответ';

      // Находим упомянутых специалистов
      const mentioned = specs.filter(s => {
        const name = (s.user?.name ?? s.name ?? '').toLowerCase();
        return name && text.toLowerCase().includes(name.split(' ')[0].toLowerCase());
      });

      this.logger.log(`[DeepSeek] Ответ: ${text.slice(0, 60)}...`);

      return {
        text,
        specialists: mentioned.length > 0 ? mentioned : undefined,
      };

    } catch (e: any) {
      this.logger.error('[DeepSeek] Ошибка:', e.response?.data ?? e.message);
      return { text: 'Извините, AI временно недоступен. Попробуйте позже.' };
    }
  }

  // ── Поиск специалистов ────────────────────────────────────

  async searchSpecialists(
    query:       string,
    specialists: any[],
    city?:       string,
  ): Promise<{ categoryId?: string; title: string; specialists: any[] }> {

    const prompt = `Запрос пользователя: "${query}". Город: ${city ?? 'Алматы'}.
Категории: 1-Ремонт, 2-Красота, 3-Репетиторы, 4-Уборка, 5-IT, 6-Перевозки, 7-Фото, 8-Юридические, 10-Дизайн, 11-Бухгалтерия.
Верни ТОЛЬКО JSON без пояснений: {"categoryId":"1","title":"Краткое название заказа"}`;

    try {
      const response = await axios.post(
        DEEPSEEK_URL,
        {
          model:       MODEL,
          messages:    [{ role: 'user', content: prompt }],
          max_tokens:  100,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type':  'application/json',
          },
          timeout: 15000,
        },
      );

      const parsed  = JSON.parse(response.data.choices[0]?.message?.content ?? '{}');
      const catId   = String(parsed.categoryId ?? '');

      const matched = catId
        ? specialists.filter(s => {
            const ids = typeof s.categoryIds === 'string'
              ? s.categoryIds : String(s.categoryIds ?? '');
            return ids.includes(catId);
          })
        : specialists;

      return {
        categoryId:  catId || undefined,
        title:       parsed.title ?? query,
        specialists: matched.slice(0, 5),
      };

    } catch (e: any) {
      this.logger.warn('[DeepSeek Search] fallback:', e.message);
      return { title: query, specialists: specialists.slice(0, 5) };
    }
  }

  // ── Health check ──────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
