import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export class CustomCrawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private maxPages: number;

  constructor(maxPages: number = 20) {
    this.maxPages = maxPages;
  }

  async crawl(
    startUrl: string, 
    onProgress: (msg: string, current: number, discovered: number) => void,
    onPage: (page: { url: string, content: string, title: string }) => Promise<void>,
    signal?: AbortSignal
  ) {
    this.queue = [startUrl];
    const baseUrl = new URL(startUrl).origin;
    let count = 0;

    while (this.queue.length > 0 && count < this.maxPages) {
      if (signal?.aborted) {
        console.log("Crawl aborted by signal");
        break;
      }

      const url = this.queue.shift()!;
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      try {
        onProgress(`Scraping: ${url}`, count, this.visited.size);
        
        const response = await axios.get(url, { 
          timeout: 15000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,el;q=0.8',
          },
          validateStatus: () => true, // Don't throw on 404/500 so we can log it
          maxRedirects: 5
        });

        if (response.status !== 200) {
           console.error(`[CRAWLER] Bad status ${response.status} for ${url}`);
           continue;
        }
        
        const $ = cheerio.load(response.data);
        const title = $('title').text() || 'No Title';
        
        // Clean text
        $('script, style, nav, footer, header').remove();
        const content = $('body').text().replace(/\s+/g, ' ').trim();

        if (content.length > 100) {
          await onPage({ url, content, title });
          count++;
        }

        // Find links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const absolute = new URL(href, url).href;
            if (absolute.startsWith(baseUrl) && !this.visited.has(absolute) && !this.queue.includes(absolute)) {
              this.queue.push(absolute);
            }
          } catch(e) {}
        });

      } catch (err: any) {
        console.error(`[CRAWLER] Error on ${url}:`, err.message);
        if (err.response) {
          console.error(`[CRAWLER] Server responded with: ${err.response.status}`);
        }
      }
    }

    onProgress(`Crawl complete. Found ${count} pages.`, count, this.visited.size);
  }
}
