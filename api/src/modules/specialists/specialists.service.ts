import {
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialist, PortfolioItem } from './entities/specialist.entity';

export interface SpecialistFilter {
  categoryId?: string;
  city?:       string;
  query?:      string;
  sortBy?:     'rating' | 'reviews' | 'price' | 'online';
  page?:       number;
  limit?:      number;
}

@Injectable()
export class SpecialistsService {
  constructor(
    @InjectRepository(Specialist)
    private readonly specialistRepo: Repository<Specialist>,

    @InjectRepository(PortfolioItem)
    private readonly portfolioRepo: Repository<PortfolioItem>,
  ) {}

  async findAll(filter: SpecialistFilter) {
    const { categoryId, city, query, sortBy = 'rating', page = 1, limit = 20 } = filter;

    const qb = this.specialistRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.portfolio', 'p')
      .where('u.isActive = :active', { active: true });

    if (city) {
      qb.andWhere('s.city = :city', { city });
    }

    if (query) {
      qb.andWhere('(u.name ILIKE :q OR s.bio ILIKE :q)', { q: `%${query}%` });
    }

    if (categoryId) {
      qb.andWhere('s.categoryIds LIKE :catPattern', { catPattern: `%${categoryId}%` });
    }

    switch (sortBy) {
      case 'rating':  qb.orderBy('s.rating',        'DESC'); break;
      case 'reviews': qb.orderBy('s.reviewCount',   'DESC'); break;
      case 'price':   qb.orderBy('s.priceFrom',     'ASC');  break;
      case 'online':  qb.orderBy('s.isOnline',      'DESC'); break;
    }

    const total = await qb.getCount();
    const data  = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async findOne(id: string): Promise<Specialist> {
    const specialist = await this.specialistRepo.findOne({
      where: { id },
      relations: ['user', 'portfolio'],
    });
    if (!specialist) throw new NotFoundException('Специалист не найден');
    // Увеличиваем счётчик просмотров
    await this.specialistRepo.increment({ id }, 'viewCount', 1);
    return specialist;
  }

  async findByUserId(userId: string): Promise<Specialist | null> {
    return this.specialistRepo.findOne({
      where: { userId },
      relations: ['user', 'portfolio'],
    });
  }

  async create(userId: string): Promise<Specialist> {
    const specialist = this.specialistRepo.create({ userId });
    return this.specialistRepo.save(specialist);
  }

  async update(id: string, data: Partial<Specialist>): Promise<Specialist> {
    await this.specialistRepo.update(id, data);
    return this.findOne(id);
  }

  async addPortfolioItem(
    specialistId: string,
    data: Partial<PortfolioItem>,
  ): Promise<PortfolioItem> {
    const item = this.portfolioRepo.create({ ...data, specialistId });
    return this.portfolioRepo.save(item);
  }

  async removePortfolioItem(itemId: string): Promise<void> {
    await this.portfolioRepo.delete(itemId);
  }

  async updateRating(specialistId: string): Promise<void> {
    // Пересчитываем рейтинг на основе отзывов
    const result = await this.specialistRepo
      .createQueryBuilder('s')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .leftJoin('reviews', 'r', 'r.targetId = s.id')
      .where('s.id = :specialistId', { specialistId })
      .getRawOne();

    await this.specialistRepo.update(specialistId, {
      rating:      parseFloat(result?.avg ?? '0') || 0,
      reviewCount: parseInt(result?.count ?? '0', 10) || 0,
    });
  }
}