import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    @InjectRepository(Specialist)
    private readonly specialistRepo: Repository<Specialist>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findBySpecialist(specialistId: string, page = 1, limit = 20) {
    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { specialistId },
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    // Загружаем авторов
    const authorIds = [...new Set(reviews.map((r) => r.authorId))];
    const authors   = authorIds.length
      ? await this.userRepo.findBy({ id: In(authorIds) })
      : [];
    const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

    const data = reviews.map((r) => ({
      ...r,
      author: authorMap[r.authorId]
        ? { id: authorMap[r.authorId].id, name: authorMap[r.authorId].name, avatar: authorMap[r.authorId].avatar }
        : null,
    }));

    // Статистика рейтинга
    const stats = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END)', 'five')
      .addSelect('SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END)', 'four')
      .addSelect('SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END)', 'three')
      .addSelect('SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END)', 'two')
      .addSelect('SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END)', 'one')
      .where('r.specialistId = :specialistId', { specialistId })
      .getRawOne();

    return {
      data,
      meta:  { page, limit, total },
      stats: {
        avg:   parseFloat(stats?.avg ?? '0'),
        total: parseInt(stats?.total ?? '0', 10),
        distribution: {
          5: parseInt(stats?.five  ?? '0', 10),
          4: parseInt(stats?.four  ?? '0', 10),
          3: parseInt(stats?.three ?? '0', 10),
          2: parseInt(stats?.two   ?? '0', 10),
          1: parseInt(stats?.one   ?? '0', 10),
        },
      },
    };
  }

  async create(
    authorId:     string,
    specialistId: string,
    rating:       number,
    text:         string,
    orderId?:     string,
  ): Promise<Review> {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Рейтинг должен быть от 1 до 5');
    }

    // Проверяем что специалист существует
    const specialist = await this.specialistRepo.findOne({
      where: { id: specialistId },
    });
    if (!specialist) throw new NotFoundException('Специалист не найден');

    // Проверяем что не оставлял отзыв на этот заказ
    if (orderId) {
      const existing = await this.reviewRepo.findOne({
        where: { authorId, orderId },
      });
      if (existing) throw new BadRequestException('Вы уже оставили отзыв');
    }

    const review = this.reviewRepo.create({
      authorId,
      specialistId,
      orderId,
      rating,
      text,
      isVerified: !!orderId,
    });

    await this.reviewRepo.save(review);

    // Пересчитываем рейтинг специалиста
    await this.recalcRating(specialistId);

    return review;
  }

  async addReply(reviewId: string, specialistUserId: string, reply: string) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Отзыв не найден');

    const specialist = await this.specialistRepo.findOne({
      where: { userId: specialistUserId },
    });
    if (!specialist || specialist.id !== review.specialistId) {
      throw new ForbiddenException('Нет доступа');
    }

    await this.reviewRepo.update(reviewId, { reply });
    return this.reviewRepo.findOne({ where: { id: reviewId } });
  }

  private async recalcRating(specialistId: string) {
    const result = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.specialistId = :specialistId', { specialistId })
      .getRawOne();

    await this.specialistRepo.update(specialistId, {
      rating:      parseFloat(result?.avg ?? '0') || 0,
      reviewCount: parseInt(result?.count ?? '0', 10) || 0,
    });
  }

  async findAll(page = 1, limit = 50) {
    const [data, total] = await this.reviewRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });
    // Загружаем авторов
    const userIds = [...new Set(data.map(r => r.authorId))];
    const users   = userIds.length
      ? await this.reviewRepo.manager.getRepository('User').findBy(
          userIds.map(id => ({ id }))
        )
      : [];
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
    return {
      data: data.map(r => ({ ...r, author: userMap[r.authorId] })),
      total, page, limit,
    };
  }

  async verify(id: string) {
    await this.reviewRepo.update(id, { isVerified: true });
    return this.reviewRepo.findOne({ where: { id } });
  }

  async remove(id: string) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) return;
    await this.reviewRepo.delete(id);
    // Пересчитываем рейтинг
    await this.recalcRating(review.specialistId);
    return { success: true };
  }
}
