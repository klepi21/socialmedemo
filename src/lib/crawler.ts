import axios from 'axios';
import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  content: string;
  title: string;
}

export class CustomCrawler {
  private visited = new Set<string>();
  private queue: string[] = [];
  private results: CrawlResult[] = [];

  constructor(private maxPages: number = 20) {}



  // Support for PDFs
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = await import('pdf-parse');
      // Hack to bypass TS strict typing on CommonJS module
      const _parse = (pdfParse as any).default || pdfParse; 
      const data = await _parse(buffer);
      return data.text;
    } catch(e) {
      return '';
    }
  }

  async crawl(baseUrl: string, onProgress?: (msg: string, current: number, discovered: number) => void, onPage?: (result: CrawlResult) => Promise<void>, abortSignal?: AbortSignal): Promise<CrawlResult[]> {
    this.queue = [baseUrl];
    this.visited.clear();
    this.results = [];

    // Base URL normalization
    let origin = '';
    try {
      origin = new URL(baseUrl).origin;
    } catch(e) {
      console.error('Invalid base URL');
      return [];
    }

    while (this.queue.length > 0 && this.results.length < this.maxPages) {
      const currentUrl = this.queue.shift()!;
      if (this.visited.has(currentUrl)) continue;
      this.visited.add(currentUrl);

      if (abortSignal?.aborted) throw new Error('ABORTED');
      if (onProgress) onProgress(`Crawling: ${currentUrl}`, this.results.length, this.queue.length + this.visited.size);

      try {
        const response = await axios.get(currentUrl, {
          timeout: 15000,
          responseType: 'arraybuffer',
          validateStatus: (status) => status >= 200 && status < 300,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        const contentType = response.headers['content-type']?.toLowerCase() || '';
        let result: CrawlResult | null = null;
        
        // --- 1. HANDLE PDF FILES --- //
        if (contentType.includes('application/pdf') || currentUrl.endsWith('.pdf')) {
          const pdfText = await this.extractTextFromPdf(response.data);
          if (pdfText.length > 50) {
            result = { url: currentUrl, content: `[PDF DOCUMENT]\nURL: ${currentUrl}\nCONTENT: ${pdfText.replace(/\s+/g, ' ')}`, title: 'PDF Document' };
          }
        } else if (contentType.includes('text/html')) {
          // --- 2. HANDLE HTML FILES --- //
          const html = Buffer.from(response.data).toString('utf-8');
          const $ = cheerio.load(html);
          
          const contactBlocks: string[] = [];
          
          // Semantic Extraction
          $('script[type="application/ld+json"]').each((_, el) => {
             try {
               const data = JSON.parse($(el).html() || '{}');
               const findNodes = (obj: any) => {
                 if (obj?.address || obj?.telephone) {
                   const addr = obj.address;
                   const text = `[OFFICIAL DATA] Address: ${addr?.streetAddress || ''}, ${addr?.addressLocality || ''} | Tel: ${obj.telephone || ''}`;
                   contactBlocks.push(text);
                 }
                 if (typeof obj === 'object') Object.values(obj).forEach(findNodes);
               };
               findNodes(data);
             } catch(e) {}
          });

          $('nav, header, footer, .sidebar, .menu, #menu, .ads, .cookie-consent, script, style, noscript, iframe').remove();
          const title = $('title').text().trim() || 'No Title';
          
          let target: cheerio.Cheerio<any> = $('body');
          const possibleContainers = ['main', 'article', '#content', '.content', '.post', '.page-content', '#vreitemas'];
          for (const sel of possibleContainers) {
            const found = $(sel);
            if (found.length > 0) {
              target = found.first();
              break;
            }
          }

          target.find('*').each((_, el) => {
            const $el = $(el);
            if ($el.is('p, div, li, h1, h2, h3, br')) {
              $el.prepend(' ').append(' ');
            }
          });

          const bodyText = target.text().replace(/\s+/g, ' ').trim();

          const ctas: string[] = [];
          $('a[href]').each((_, el) => {
             const text = $(el).text().trim();
             const href = $(el).attr('href');
             if (text.length > 2 && /ραντεβου|κλεισε|book|contact|επικοινωνια|τηλ|call/i.test(text)) {
               ctas.push(`[CTA: ${text} -> ${href}]`);
             }
          });

          const finalContent = 
            `TITLE: ${title}\n` +
            `URL: ${currentUrl}\n` +
            (contactBlocks.length > 0 ? `CONTACT DATA: ${contactBlocks.join(' | ')}\n` : '') +
            (ctas.length > 0 ? `QUICK ACTIONS: ${ctas.join(' | ')}\n` : '') +
            `MAIN CONTENT: ${bodyText}`;

          if (bodyText.length > 20) {
            result = { url: currentUrl, content: finalContent, title };
          }

          // EXHAUSTIVE LINK DISCOVERY
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
            
            try {
              const urlObj = new URL(href, currentUrl);
              const cleanUrl = urlObj.href.split('#')[0];
              if (cleanUrl.length > 300) return;
              if (cleanUrl.includes('%3C') || cleanUrl.includes('<') || cleanUrl.includes('%3E')) return;
              if (cleanUrl.includes('?share=') || cleanUrl.includes('&prd=')) return;

              if (
                urlObj.origin === origin && 
                !this.visited.has(cleanUrl) && 
                !this.queue.includes(cleanUrl) &&
                !cleanUrl.match(/\.(png|jpg|jpeg|gif|svg|webp|mp4|webm)$/i)
              ) {
                this.queue.push(cleanUrl);
              }
            } catch (e) {}
          });
        }

        if (result) {
          this.results.push(result);
          if (onPage) await onPage(result);
        }

      } catch (error: any) {
        console.error(`Crawler failed on ${currentUrl}:`, error?.message || error);
        this.visited.add(currentUrl);
      }
    }

    return this.results;
  }
}
