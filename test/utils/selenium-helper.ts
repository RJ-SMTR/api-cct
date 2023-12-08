import { Builder, By, WebDriver, WebElement } from 'selenium-webdriver';

export interface Email {
  title: string;
  recipient: string;
  isSelected: boolean;
  isRead: boolean;
  receivedDate: string;
  element: WebElement;
}

export class MaildevScraper {
  private driver: WebDriver;
  private maildevUrl: string;
  private isDefaultContent: boolean;

  constructor(args?: { maildevUrl?: string; minimizeWindow?: boolean }) {
    const minimizeWindow =
      args?.minimizeWindow === undefined ? true : args?.minimizeWindow;
    this.driver = new Builder().forBrowser('chrome').build();
    if (args?.maildevUrl) {
      this.maildevUrl = args.maildevUrl;
    }
    this.isDefaultContent = true;
    (async () => {
      await this.adjustWindow(minimizeWindow);
    })().catch((error: Error) => {
      throw error;
    });
  }

  async adjustWindow(minimize?: boolean): Promise<void> {
    const width = 1200;
    const height = 800;
    try {
      const screenResolution: any = await this.driver.executeScript(
        'return { width: window.screen.width, height: window.screen.height };',
      );

      const centerX = Math.max(0, (screenResolution.width - width) / 2);
      const centerY = Math.max(0, (screenResolution.height - height) / 2);
      await this.driver
        .manage()
        .window()
        .setRect({ width, height, x: centerX, y: centerY });

      // Minimize the window
      if (minimize) {
        await this.driver.manage().window().minimize();
      }
    } catch (error) {
      console.error('Error while resizing and minimizing window:', error);
    }
  }

  async handleIfDefaultContent() {
    if (!this.isDefaultContent) {
      await this.driver.switchTo().defaultContent();
    }
    this.isDefaultContent = true;
  }

  async openMailDev() {
    await this.driver.get(this.maildevUrl);
  }

  async getSidebarEmails(limit = 10): Promise<Email[]> {
    const emailElements: WebElement[] = await this.driver.findElements(
      By.css('.email-item'),
    );
    const emails: Email[] = [];

    for (let i = 0; i < limit; i++) {
      const element = emailElements[i];
      const classes = (await element.getAttribute('class')).split(' ');
      const isSelected = classes.includes('current');
      const isRead = classes.includes('read');
      const title = (
        await element.findElement(By.css('.title')).getText()
      ).split(' To:')[0];
      const recipient = (
        await element.findElement(By.css('.title-subline')).getText()
      )
        .split('To:')[1]
        .trim();
      const receivedDate = await element
        .findElement(By.css('.subline'))
        .getText();

      emails.push({
        title,
        recipient,
        receivedDate,
        isSelected,
        isRead,
        element,
      });
    }

    return emails;
  }

  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async waitDriver() {
    await this.driver.wait(function () {
      return this.driver
        .executeScript('return document.readyState')
        .then(function (readyState) {
          return readyState === 'complete';
        });
    });
  }

  async findElementsInMailContent(args: {
    tagName?: string;
    innerText?: string;
    classes?: string[];
    id?: string;
  }): Promise<WebElement[]> {
    const iframeSelector = By.css('.email-content-view-html > iframe');
    const bodySelector = By.css('body');

    const iframeElement = await this.driver.findElement(iframeSelector);

    await this.driver.switchTo().frame(iframeElement);
    this.isDefaultContent = false;

    const bodyElement = await this.driver.findElement(bodySelector);

    let xpath = './/*'; // Start with any element

    if (args?.tagName) {
      xpath += `[local-name()="${args.tagName}"]`;
    }

    if (args?.innerText) {
      xpath += `[contains(text(), "${args.innerText}")]`;
    }

    if (args?.classes && args.classes.length > 0) {
      const classCondition = args.classes
        .map((className) => `contains(@class, "${className}")`)
        .join(' and ');
      xpath += `[${classCondition}]`;
    }

    if (args?.id) {
      xpath += `[@id="${args.id}"]`;
    }

    const elements = await bodyElement.findElements(By.xpath(xpath));

    return elements;
  }

  async clickEmail(email: Email) {
    if (!this.isDefaultContent) {
      await this.handleIfDefaultContent();
    }
    await email.element.click();
  }

  async deleteAllEmails() {
    await this.handleIfDefaultContent();
    const deleteAllEmails = await this.driver.findElement(
      By.xpath(`//a[@title="Delete all emails"]`),
    );
    await deleteAllEmails.click();
    await deleteAllEmails.click();
  }

  async close() {
    await this.driver.quit();
  }
}

// let frontendLink: string = '';
// await maildev.sleep(1000);
// const mails = (await maildev.getSidebarEmails())
//   .filter(i => ['Redefinir senha', 'Refedinir senha'].includes(i.title)
//     && i.recipient === ADMIN_2_EMAIL);
// expect(mails.length).toBeGreaterThan(0);
// const mail = mails[0];
// expect(differenceInSeconds(forgotLocalDate, new Date(mail.receivedDate))).toBeLessThanOrEqual(10);
// if (!mail.isSelected) {
//   await maildev.clickEmail(mails[0])
//   await maildev.sleep(1000);
// }
// const elements = await maildev.findElementsInMailContent({ tagName: 'a', innerText: 'Redefinir senha.' });
// expect(elements.length).toBeGreaterThan(0);
// const resetPassButton = elements[0];
// frontendLink = await resetPassButton.getAttribute('href');
// let hash = (frontendLink.split('/').pop() as String);
