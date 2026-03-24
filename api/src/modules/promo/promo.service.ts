import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { PromoCode, PromoType, PromoUsage, Referral, ReferralStatus } from './promo.entity';
import { User } from '../users/entities/user.entity';

const REFERRAL_BONUS = 500; // ₸ за каждого приглашённого

@Injectable()
export class PromoService {
  constructor(
    @InjectRepository(PromoCode)
    private readonly promoRepo: Repository<PromoCode>,

    @InjectRepository(PromoUsage)
    private readonly usageRepo: Repository<PromoUsage>,

    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Validate promo code ────────────────────────────────────

  async validate(code: string, userId: string) {
    const promo = await this.promoRepo.findOne({
      where: { code: code.toUpperCase(), isActive: true },
    });

    if (!promo) {
      return { valid: false };
    }

    // Проверяем срок действия
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return { valid: false };
    }

    // Проверяем лимит использований
    if (promo.maxUsage && promo.usageCount >= promo.maxUsage) {
      return { valid: false };
    }

    // Проверяем, не использовал ли уже этот пользователь
    const alreadyUsed = await this.usageRepo.findOne({
      where: { userId, promoCodeId: promo.id },
    });
    if (alreadyUsed) {
      throw new BadRequestException('Промокод уже был использован');
    }

    return {
      valid: true,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      description: promo.description,
      minOrderAmount: promo.minOrderAmount,
    };
  }

  // ── Apply promo to order ───────────────────────────────────

  async apply(code: string, orderId: string, userId: string, orderAmount: number) {
    const result = await this.validate(code, userId);
    if (!result.valid) throw new BadRequestException('Промокод недействителен');

    const promo = await this.promoRepo.findOne({
      where: { code: code.toUpperCase() },
    });

    if (promo && promo.minOrderAmount && orderAmount < promo.minOrderAmount) {
      throw new BadRequestException(
        `Минимальная сумма заказа для этого промокода: ${promo.minOrderAmount} ₸`,
      );
    }

    // Считаем скидку
    let discountAmount = 0;
    if (promo && promo.type === PromoType.PERCENT) {
      discountAmount = Math.floor((orderAmount * promo.value) / 100);
    } else if (promo && promo.type === PromoType.FIXED) {
      discountAmount = Math.min(promo.value, orderAmount);
    }

    // Сохраняем использование
    const usage = this.usageRepo.create({
      userId,
      promoCodeId: promo && promo.id ? promo.id : '',
      orderId,
      discountAmount,
    });
    await this.usageRepo.save(usage);
    await this.promoRepo.increment({ id: promo && promo.id ? promo.id : '' }, 'usageCount', 1);

    return { discountAmount, finalAmount: orderAmount - discountAmount };
  }

  // ── Referral info ──────────────────────────────────────────

  async getReferralInfo(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    // Генерируем реферальный код если нет
    if (!(user as any).referralCode) {
      const code = `MASTER${uuid().slice(0, 6).toUpperCase()}`;
      await this.userRepo.update(userId, { referralCode: code } as any);
      (user as any).referralCode = code;
    }

    const referralCode = (user as any).referralCode;
    const referralLink = `https://master.kz/join?ref=${referralCode}`;

    const referrals = await this.referralRepo.find({
      where: { referrerId: userId },
      relations: ['referee'],
      order: { createdAt: 'DESC' },
    });

    const earnedBonus = referrals
      .filter(r => r.bonusPaid)
      .reduce((sum, r) => sum + r.bonus, 0);

    const pendingBonus = referrals
      .filter(r => !r.bonusPaid && r.status === ReferralStatus.FIRST_ORDER)
      .reduce((sum, r) => sum + REFERRAL_BONUS, 0);

    return {
      referralCode,
      referralLink,
      totalReferrals: referrals.length,
      earnedBonus,
      pendingBonus,
      referrals: referrals.map(r => ({
        id: r.id,
        name: r.referee?.name ?? 'Пользователь',
        joinedAt: r.createdAt,
        status: r.status,
        bonus: r.bonus,
      })),
    };
  }

  // ── Apply referral on registration ────────────────────────

  async applyReferral(referralCode: string, newUserId: string) {
    const referrer = await this.userRepo.findOne({
      where: { referralCode } as any,
    });

    if (!referrer) return; // тихо игнорируем неверный код

    const existing = await this.referralRepo.findOne({
      where: { refereeId: newUserId },
    });
    if (existing) return;

    const referral = this.referralRepo.create({
      referrerId: referrer.id,
      refereeId: newUserId,
      status: ReferralStatus.REGISTERED,
      bonus: 0,
    });
    await this.referralRepo.save(referral);
  }

  // ── Called when referred user completes first order ───────

  async onFirstOrder(userId: string) {
    const referral = await this.referralRepo.findOne({
      where: { refereeId: userId, status: ReferralStatus.REGISTERED },
    });
    if (!referral) return;

    await this.referralRepo.update(referral.id, {
      status: ReferralStatus.FIRST_ORDER,
      bonus: REFERRAL_BONUS,
    });

    // TODO: начислить бонус referrerId через систему балансов
    // await this.balanceService.credit(referral.referrerId, REFERRAL_BONUS, 'referral')
  }
}
