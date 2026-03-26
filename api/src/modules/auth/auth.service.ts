import {
  BadRequestException, Injectable, Logger,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { User, UserRole } from '../users/entities/user.entity';
import { Specialist } from '../specialists/entities/specialist.entity';
import { RegisterDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Specialist)
    private readonly specialistRepo: Repository<Specialist>,

    private readonly jwtService:    JwtService,
    private readonly configService: ConfigService,

    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ── OTP ────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<{ expiresIn: number }> {
    // Генерируем 6-значный код
    const isDev = this.configService.get('app.isDev');
    const code  = isDev ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

    const expiresIn = this.configService.get<number>('otp.expiresIn') ?? 300;
    const key       = `otp:${phone}`;

    // Сохраняем в Redis с TTL
    await this.redis.setex(key, expiresIn, code);

    if (isDev) {
      this.logger.log(`[DEV] OTP для ${phone}: ${code}`);
    } else {
      await this.sendSms(phone, code);
    }

    return { expiresIn };
  }

  async verifyOtp(phone: string, code: string): Promise<{
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    const key     = `otp:${phone}`;
    const stored  = await this.redis.get(key);

    if (!stored || stored !== code) {
      throw new BadRequestException('Неверный или истёкший код');
    }

    // Удаляем OTP после успешной верификации
    await this.redis.del(key);

    // Ищем пользователя
    const user = await this.userRepo.findOne({ where: { phone } });

    if (!user) {
      // Новый пользователь — возвращаем без токенов
      return { user: null, accessToken: null, refreshToken: null };
    }

    // Обновляем lastLoginAt
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  }

  // ── Registration ───────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    // Проверяем что нет дубликата
    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) {
      // Пользователь уже есть — просто возвращаем токены
      const tokens = await this.generateTokens(existing);
      return { user: existing, ...tokens };
    }

    const user = this.userRepo.create({
      phone:      dto.phone,
      name:       dto.name,
      role:       dto.role as UserRole ?? UserRole.CLIENT,
      city:       dto.city,
      isVerified: false,
    });

    await this.userRepo.save(user);

    // Автоматически создаём профиль специалиста
    if (user.role === UserRole.SPECIALIST) {
      const specialist = this.specialistRepo.create({
        userId: user.id,
        city:   dto.city,
      });
      await this.specialistRepo.save(specialist);
      this.logger.log(`Создан профиль специалиста для ${user.id}`);
    }

    const tokens = await this.generateTokens(user);
    return { user, ...tokens };
  }

  // ── Token refresh ──────────────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Refresh токен недействителен');
      }

      const tokens = await this.generateTokens(user);
      return { user, ...tokens };

    } catch {
      throw new UnauthorizedException('Refresh токен истёк или недействителен');
    }
  }

  // ── Logout ─────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      refreshToken: '',
      pushToken: null,           // Expo push token
      webPushSubscription: null, // Web push subscription
    } as any)
  }

  // ── Me ─────────────────────────────────────────────────────

  async getMe(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  // ── Helpers ────────────────────────────────────────────────

  private async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret:    this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      }),
    ]);

    // Сохраняем refresh токен в БД
    await this.userRepo.update(user.id, { refreshToken });

    return { accessToken, refreshToken };
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const provider = this.configService.get('otp.provider');
    this.logger.log(`Отправка SMS на ${phone} через ${provider}`);
    // TODO: интеграция с SMS провайдером (Twilio, SMSC.ru, etc.)
    // Пример для SMSC.ru:
    // await axios.get(`https://smsc.ru/sys/send.php?login=...&psw=...&phones=${phone}&mes=Ваш код: ${code}`)
  }
}
