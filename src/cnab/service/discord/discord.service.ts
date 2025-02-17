import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CustomLogger } from '../../../utils/custom-logger';

@Injectable()
export class DiscordService {
  private readonly webhookUrl ;

  private logger = new CustomLogger(DiscordService.name, { timestamp: true });


  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  async sendMessage(content: string): Promise<void> {
    try {
      // Only send message to Discord in production
      if (process.env.NODE_ENV === 'production') {
        const devsRoleId = '1118274986461888612';
        const payload = {
          content: `<@&${devsRoleId}> ${content}`,
          allowed_mentions: { roles: [devsRoleId] }
        };
        await axios.post(this.webhookUrl, payload);
        this.logger.log(`Message sent to Discord successfully: ${content}', 'sendMessage`);
      }
    } catch (error) {
      this.logger.error('Error sending message to Discord:', error.response?.data || error.message || error);
    }
  }
}