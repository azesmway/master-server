import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(filter: { page?: number; limit?: number; role?: string }) {
    const { page = 1, limit = 50, role } = filter;
    const where = role ? { role: role as any } : {};
    const [data, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
      select: ['id', 'phone', 'name', 'email', 'avatar', 'role',
               'isVerified', 'isActive', 'city', 'createdAt', 'updatedAt'],
    });
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    return this.update(id, { avatar: avatarUrl });
  }
}
