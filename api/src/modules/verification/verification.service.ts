import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification, VerificationStatus } from './verification.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Verification)
    private readonly verRepo: Repository<Verification>,

    @InjectRepository(Specialist)
    private readonly specRepo: Repository<Specialist>,

    private readonly notificationsService: NotificationsService,
  ) {}

  // Специалист подаёт заявку на верификацию
  async apply(specialistId: string, documentUrls: string[]): Promise<Verification> {
    if (!documentUrls?.length) {
      throw new BadRequestException('Загрузите хотя бы один документ');
    }

    // Проверяем нет ли уже активной заявки
    const existing = await this.verRepo.findOne({
      where: { specialistId, status: VerificationStatus.PENDING },
    });
    if (existing) {
      throw new BadRequestException('Заявка уже подана и ожидает рассмотрения');
    }

    const verification = this.verRepo.create({
      specialistId,
      documents: documentUrls,
      status:    VerificationStatus.PENDING,
    });

    return this.verRepo.save(verification);
  }

  // Получить статус верификации специалиста
  async getStatus(specialistId: string) {
    const verification = await this.verRepo.findOne({
      where:  { specialistId },
      order:  { createdAt: 'DESC' },
    });

    const specialist = await this.specRepo.findOne({ where: { id: specialistId } });

    return {
      isVerified:   specialist?.isVerified ?? false,
      verification: verification ?? null,
    };
  }

  // Список заявок для админа
  async findAll(status?: VerificationStatus) {
    const where = status ? { status } : {};
    const items = await this.verRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // Загружаем специалистов
    const specIds  = [...new Set(items.map(i => i.specialistId))];
    const specs    = specIds.length
      ? await this.specRepo.find({ where: specIds.map(id => ({ id })) })
      : [];
    const specMap  = Object.fromEntries(specs.map(s => [s.id, s]));

    return items.map(item => ({ ...item, specialist: specMap[item.specialistId] }));
  }

  // Админ одобряет/отклоняет верификацию
  async review(
    verificationId: string,
    adminId:        string,
    approved:       boolean,
    comment?:       string,
  ): Promise<Verification> {
    const verification = await this.verRepo.findOne({ where: { id: verificationId } });
    if (!verification) throw new NotFoundException('Заявка не найдена');
    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Заявка уже рассмотрена');
    }

    const status = approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

    await this.verRepo.update(verificationId, {
      status,
      comment,
      reviewedBy: adminId,
    });

    // Обновляем флаг верификации у специалиста
    if (approved) {
      await this.specRepo.update(verification.specialistId, { isVerified: true });
    }

    // Уведомляем специалиста
    const specialist = await this.specRepo.findOne({
      where: { id: verification.specialistId },
    });

    if (specialist) {
      await this.notificationsService.sendToUser(
        specialist.userId,
        approved ? '✅ Верификация одобрена' : '❌ Верификация отклонена',
        approved
          ? 'Поздравляем! Ваш профиль прошёл верификацию. Теперь у вас есть значок ✓'
          : `Верификация отклонена. ${comment ?? 'Проверьте загруженные документы.'}`,
        { type: 'verification', status },
      );
    }

    return this.verRepo.findOne({ where: { id: verificationId } }) as Promise<Verification>;
  }
}
