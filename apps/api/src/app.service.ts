import { Injectable } from '@nestjs/common';
import { version } from '../../../package.json';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'api',
      version,
      timestamp: new Date().toISOString()
    };
  }
}
