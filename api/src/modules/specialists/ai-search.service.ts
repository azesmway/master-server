import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface AiSearchResult {
  query:       string;
  categoryId:  string | null;
  title:       string;
  description: string;
  budgetHint:  string | null;
  specialists: any[];
}

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(private readonly configService: ConfigService) {}

  async search(query: string, specialists: any[]): Promise<AiSearchResult> {
    // Системный промпт для анализа запроса
    const systemPrompt = `Ты помощник маркетплейса услуг "Мастер" в Казахстане.
Пользователь описывает задачу — твоя цель:
1. Определить категорию услуги
2. Составить краткое название заказа
3. Уточнить описание задачи
4. Подсказать примерный бюджет (в тенге)
5. Выбрать подходящих специалистов из списка

Категории: 1-Ремонт, 2-Красота, 3-Репетиторы, 4-Уборка, 5-IT, 6-Перевозки, 7-Фото/видео, 8-Юридические, 9-Языковые, 10-Дизайн, 11-Бухгалтерия, 12-Медицина

Отвечай ТОЛЬКО JSON без markdown:
{
  "categoryId": "1",
  "title": "Краткое название заказа",
  "description": "Уточнённое описание",
  "budgetHint": "5000-15000",
  "specialistIds": ["id1", "id2"]
}`;

    const userMessage = `Запрос пользователя: "${query}"

Доступные специалисты (JSON):
${JSON.stringify(specialists.slice(0, 10).map((s) => ({
  id:         s.id,
  name:       s.user?.name,
  categories: s.categoryIds,
  rating:     s.rating,
  city:       s.city,
  bio:        s.bio?.slice(0, 100),
})))}`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-20250514',
          max_tokens: 500,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userMessage }],
        },
        {
          headers: {
            'x-api-key':         process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 10000,
        },
      );

      const text = response.data.content[0]?.text ?? '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

      // Находим специалистов по IDs
      const matchedSpecialists = parsed.specialistIds
        ? specialists.filter((s) => parsed.specialistIds.includes(s.id))
        : specialists.slice(0, 3);

      return {
        query,
        categoryId:  parsed.categoryId ?? null,
        title:       parsed.title      ?? query,
        description: parsed.description ?? query,
        budgetHint:  parsed.budgetHint ?? null,
        specialists: matchedSpecialists,
      };

    } catch (e) {
      this.logger.warn('[AI Search] Ошибка:', e.message);

      // Fallback — простой поиск без AI
      return {
        query,
        categoryId:  null,
        title:       query,
        description: query,
        budgetHint:  null,
        specialists: specialists.slice(0, 5),
      };
    }
  }
}
