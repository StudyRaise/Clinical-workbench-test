import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, AuthenticatedUser } from './auth.interfaces';

/**
 * Passport JWT 策略：从 Authorization: Bearer <token> 中提取 JWT 并校验签名，
 * 校验通过后把 userId / facilityId / role 挂到 req.user。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-only-change-me')
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // 返回值会成为 req.user
    return {
      userId: payload.sub,
      facilityId: payload.facilityId,
      role: payload.role
    };
  }
}
