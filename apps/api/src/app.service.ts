import { Injectable } from '@nestjs/common';

const VERSION = '0.1.0';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'api',
      version: VERSION,
      timestamp: new Date().toISOString()
    };
  }
}
