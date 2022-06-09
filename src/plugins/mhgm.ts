import { Plugin } from '~/plugins';
import queryString from 'query-string';
import LZString from 'lz-string';
import cheerio from 'cheerio';
import Base from './base';

const { UpdateStatus } = window;
const PATTERN_MANGA_ID = /^https:\/\/m\.manhuagui\.com\/comic\/([0-9]+)/;
const PATTERN_MANGA_INFO = /{ bid:([0-9]*), status:[0-9]*,block_cc:'' }/;
const PATTERN_CHAPTER_ID = /^https:\/\/m\.manhuagui\.com\/comic\/[0-9]+\/([0-9]+)(?=\.html|$)/;
const PATTERN_SCRIPT = /^window\["\\x65\\x76\\x61\\x6c"\](.+)(?=$)/;
const PATTERN_READER_DATA = /^SMH\.reader\((.+)(?=\)\.preInit\(\);)/;

class ManHuaGuiMobile extends Base {
  readonly useMock = false;

  constructor(pluginID: Plugin, pluginName: string, pluginShortName: string) {
    super(pluginID, pluginName, pluginShortName);
  }

  prepareUpdateFetch: Base['prepareUpdateFetch'] = (page) => {
    if (this.useMock) {
      return {
        url: process.env.PROXY + '/update',
        body: {
          page,
          ajax: 1,
          order: 1,
        },
      };
    }

    return {
      url: 'https://m.manhuagui.com/update/',
      body: {
        page,
        ajax: 1,
        order: 1,
      },
    };
  };
  prepareSearchFetch: Base['prepareSearchFetch'] = (keyword, page) => {
    const body = new FormData();
    body.append('key', keyword);
    body.append('page', String(page));
    body.append('ajax', '1');
    body.append('order', '1');

    if (this.useMock) {
      return {
        url: process.env.PROXY + '/search',
        method: 'POST',
        body: page > 1 ? body : undefined,
      };
    }

    return {
      url: `https://m.manhuagui.com/s/${keyword}.html/`,
      method: 'POST',
      body: page > 1 ? body : undefined,
    };
  };
  prepareMangaFetch: Base['prepareMangaFetch'] = (mangaId) => {
    if (this.useMock) {
      return {
        url: process.env.PROXY + '/manga',
      };
    }

    return {
      url: 'https://m.manhuagui.com/comic/' + mangaId,
    };
  };
  prepareChapterFetch: Base['prepareChapterFetch'] = (mangaId, chapterId) => {
    if (this.useMock) {
      return {
        url: process.env.PROXY + '/chapter',
      };
    }

    return {
      url: `https://m.manhuagui.com/comic/${mangaId}/${chapterId}.html`,
    };
  };

  handleUpdate: Base['handleUpdate'] = (text) => {
    try {
      const $ = cheerio.load(text || '');
      const list: Manga[] = [];

      $('li > a')
        .toArray()
        .forEach((a) => {
          const $$ = cheerio.load(a);
          const href = 'https://m.manhuagui.com' + (a as any).attribs.href;
          const title = $$('h3').first().text();
          const statusLabel = $$('div.thumb i').first().text(); // 连载 or 完结
          const cover = 'https:' + $$('div.thumb img').first().attr('data-src');
          const [author, tag, latest, updateTime] = $$('dl')
            .toArray()
            .map((dl) => cheerio.load(dl).root().text());
          const [, mangaId] = href.match(PATTERN_MANGA_ID) || [];

          let status = UpdateStatus.Unknow;
          if (statusLabel === '连载') {
            status = UpdateStatus.Serial;
          }
          if (statusLabel === '完结') {
            status = UpdateStatus.End;
          }

          if (!mangaId || !title) {
            return;
          }

          list.push({
            href,
            hash: Base.combineHash(this.id, mangaId),
            source: this.id,
            sourceName: this.name,
            mangaId,
            title,
            status,
            cover,
            latest,
            updateTime,
            author,
            tag,
            chapters: [],
          });
        });

      return { update: list };
    } catch {
      return { error: new Error('Fail to handleUpdate') };
    }
  };

  handleSearch: Base['handleSearch'] = (text) => {
    try {
      const $ = cheerio.load(text || '');
      const list: Manga[] = [];

      $('li > a')
        .toArray()
        .forEach((a) => {
          const $$ = cheerio.load(a);
          const href = 'https://m.manhuagui.com' + (a as any).attribs.href;
          const title = $$('h3').first().text();
          const statusLabel = $$('div.thumb i').first().text(); // 连载 or 完结
          const cover = 'https:' + $$('div.thumb img').first().attr('data-src');
          const [author, tag, latest, updateTime] = $$('dl')
            .toArray()
            .map((dl) => cheerio.load(dl).root().text());
          const [, mangaId] = href.match(PATTERN_MANGA_ID) || [];

          let status = UpdateStatus.Unknow;
          if (statusLabel === '连载') {
            status = UpdateStatus.Serial;
          }
          if (statusLabel === '完结') {
            status = UpdateStatus.End;
          }

          if (!mangaId || !title) {
            return;
          }

          list.push({
            href,
            hash: Base.combineHash(this.id, mangaId),
            source: this.id,
            sourceName: this.name,
            mangaId,
            title,
            status,
            cover,
            latest,
            updateTime,
            author,
            tag,
            chapters: [],
          });
        });

      return { search: list };
    } catch {
      return { error: new Error('Fail to handleSearch') };
    }
  };

  handleManga: Base['handleManga'] = (text) => {
    try {
      const $ = cheerio.load(text || '');
      const manga: Manga = {
        href: '',
        hash: '',
        source: this.id,
        sourceName: this.name,
        mangaId: '',
        cover: '',
        title: '',
        latest: '',
        updateTime: '',
        author: '',
        tag: '',
        status: UpdateStatus.Unknow,
        chapters: [],
      };
      const chapters: ChapterItem[] = [];

      const scriptContent: string = $('script:not([src]):not([type])').get(1).children[0].data;
      const [, mangaId] = scriptContent.match(PATTERN_MANGA_INFO) || [];
      const statusLabel = $('div.book-detail div.thumb i').first().text(); // 连载 or 完结

      const [latest, updateTime, author, tag] = $('div.cont-list dl')
        .toArray()
        .map((dl) => cheerio.load(dl).root().text());

      const isAudit = $('#erroraudit_show').length > 0;

      if (isAudit) {
        const encodeHtml = $('#__VIEWSTATE').first().attr('value') || '';
        const decodeHtml = LZString.decompressFromBase64(encodeHtml);

        if (decodeHtml) {
          const $$ = cheerio.load(decodeHtml);

          $$('ul > li > a')
            .toArray()
            .forEach((item) => {
              const $$$ = cheerio.load(item);
              const title = $$$('b').first().text();
              const href = 'https://m.manhuagui.com' + (item as any).attribs.href;
              const [, chapterId] = href.match(PATTERN_CHAPTER_ID) || [];

              chapters.push({
                hash: Base.combineHash(this.id, mangaId, chapterId),
                mangaId,
                chapterId,
                href,
                title,
              });
            });
        }
      } else {
        $('#chapterList > ul > li > a')
          .toArray()
          .forEach((item) => {
            const $$ = cheerio.load(item);
            const title = $$('b').first().text();
            const href = 'https://m.manhuagui.com' + (item as any).attribs.href;
            const [, chapterId] = href.match(PATTERN_CHAPTER_ID) || [];

            chapters.push({
              hash: Base.combineHash(this.id, mangaId, chapterId),
              mangaId,
              chapterId,
              href,
              title,
            });
          });
      }

      if (statusLabel === '连载') {
        manga.status = UpdateStatus.Serial;
      }
      if (statusLabel === '完结') {
        manga.status = UpdateStatus.End;
      }

      manga.href = 'https://m.manhuagui.com/comic/' + mangaId;
      manga.mangaId = mangaId;
      manga.hash = Base.combineHash(this.id, mangaId);
      manga.title = $('div.main-bar > h1').first().text();
      manga.cover = 'https:' + $('div.thumb img').first().attr('src');
      manga.latest = latest;
      manga.updateTime = updateTime;
      manga.author = author;
      manga.tag = tag;
      manga.chapters = chapters;

      return { manga };
    } catch {
      return { error: new Error('Fail to handleManga') };
    }
  };

  handleChapter: Base['handleChapter'] = (text) => {
    try {
      const $ = cheerio.load(text || '');
      const scriptAfterFilter = (
        $('script:not([src])').toArray() as unknown as HTMLSpanElement[]
      ).filter((item) => PATTERN_SCRIPT.test((item.children[0] as any).data));

      if (scriptAfterFilter.length <= 0) {
        throw new Error('without chapter info');
      }
      const script = (scriptAfterFilter[0].children[0] as any).data;
      const [, scriptContent] = script.match(PATTERN_SCRIPT) || [];

      // eslint-disable-next-line no-eval
      const readerScript = eval(scriptContent) as string;
      const [, stringifyData] = readerScript.match(PATTERN_READER_DATA) || [];
      const data = JSON.parse(stringifyData);

      const { bookId, chapterId, bookName, chapterTitle, images = [], sl } = data;

      return {
        chapter: {
          hash: Base.combineHash(this.id, bookId, chapterId),
          mangaId: bookId,
          chapterId,
          name: bookName,
          title: chapterTitle,
          headers: {
            Host: 'i.hamreus.com',
            referer: 'https://m.manhuagui.com/',
            Connection: 'keep-alive',
            accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'cross-site',
            'Cache-control': 'no-cache',
            'user-agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
          },
          images: images.map((item: string) =>
            encodeURI(decodeURI('https://i.hamreus.com' + item + '?' + queryString.stringify(sl)))
          ),
        },
      };
    } catch {
      return { error: new Error('Fail to handleChapter') };
    }
  };
}

export default ManHuaGuiMobile;