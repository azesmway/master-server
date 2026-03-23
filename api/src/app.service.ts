import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status:    'ok',
      version:   process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date(),
      uptime:    Math.floor(process.uptime()),
    };
  }
}
