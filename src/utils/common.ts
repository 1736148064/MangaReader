import queryString from 'query-string';
import LZString from 'lz-string';
import cheerio from 'cheerio';

// eslint-disable-next-line no-extend-native
String.prototype.splic = function (f: string): string[] {
  return LZString.decompressFromBase64(this.toString())?.split(f) || [];
};

export const PATTERN_MANGA_ID = /^https:\/\/m\.manhuagui\.com\/comic\/[0-9]+(?=\/$|$)/g;
export const PATTERN_CHAPTER_ID =
  /^https:\/\/m\.manhuagui\.com\/comic\/[0-9]+\/[0-9]+(?=\.html|$)/g;
export const PATTERN_SCRIPT = /^window\["\\x65\\x76\\x61\\x6c"\].+(?=$)/g;
export const PATTERN_READER_DATA = /^SMH\.reader\(.+(?=\)\.preInit\(\);)/g;

export function firstMatch(matchResult: ReturnType<typeof String.prototype.match>): string {
  return matchResult ? matchResult[0] : '';
}

/** extract data from bookshelf */
export function handleBookshelf(text: string): Manga[] {
  const $ = cheerio.load(text);
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
      const id = firstMatch(href.match(PATTERN_MANGA_ID)).replace(
        'https://m.manhuagui.com/comic/',
        ''
      );

      let status: UpdateStatus = 0;
      if (statusLabel === '连载') {
        status = 1;
      }
      if (statusLabel === '完结') {
        status = 2;
      }

      if (!id || !title) {
        return;
      }

      list.push({
        id,
        title,
        status,
        cover,
        latest,
        updateTime,
        author,
        tag,
      });
    });

  return list;
}

/** extract data from manga detail */
export function handleManga(text: string): { manga: Manga; chapter: ChapterItem[] } {
  const $ = cheerio.load(text);
  const manga: Manga = {
    id: '',
    cover: '',
    title: '',
    latest: '',
    updateTime: '',
    author: '',
    tag: '',
    status: 0,
  };
  const chapter: ChapterItem[] = [];

  const [latest, updateTime, author, tag] = $('div.cont-list dl')
    .toArray()
    .map((dl) => cheerio.load(dl).root().text());
  const statusLabel = $('div.thumb i').first().text(); // 连载 or 完结

  $('#chapterList > ul > li > a')
    .toArray()
    .forEach((item) => {
      const $$ = cheerio.load(item);
      const title = $$('b').first().text();
      const href = 'https://m.manhuagui.com' + (item as any).attribs.href;
      const [mangaId, chapterId] = firstMatch(href.match(PATTERN_CHAPTER_ID))
        .replace('https://m.manhuagui.com/comic/', '')
        .split('/');

      chapter.push({
        mangaId,
        chapterId,
        href,
        title,
      });
    });

  if (statusLabel === '连载') {
    manga.status = 1;
  }
  if (statusLabel === '完结') {
    manga.status = 2;
  }

  manga.title = $('div.main-bar > h1').first().text();
  manga.cover = 'https:' + $('div.thumb img').first().attr('src');
  manga.latest = latest;
  manga.updateTime = updateTime;
  manga.author = author;
  manga.tag = tag;

  return { manga, chapter };
}

export function handleChapter(text: string): Chapter {
  const $ = cheerio.load(text);
  const script = (
    ($('script:not([src])').eq(0)[0] as unknown as HTMLScriptElement).children[0] as Element & {
      data: string;
    }
  ).data;
  const scriptContent = firstMatch(script.match(PATTERN_SCRIPT)).replace(
    'window["\\x65\\x76\\x61\\x6c"]',
    ''
  );

  let data: any;
  try {
    // eslint-disable-next-line no-eval
    const readerScript = eval(scriptContent) as string;
    const stringifyData = firstMatch(readerScript.match(PATTERN_READER_DATA)).replace(
      'SMH.reader(',
      ''
    );

    data = JSON.parse(stringifyData);
  } catch (e) {
    data = {};
    console.error(e);
  }

  const { bookId, chapterId, bookName, chapterTitle, images = [], nextId, prevId, sl } = data;

  return {
    mangaId: bookId,
    chapterId,
    name: bookName,
    title: chapterTitle,
    images: images.map(
      (item: string) => 'https://i.hamreus.com' + item + '?' + queryString.stringify(sl)
    ),
    nextId,
    prevId,
  };
}

export function scaleToFill(
  img: { width: number; height: number },
  container: { width: number; height: number }
) {
  const scale = Math.max(container.width / img.width, container.height / img.height);
  const dx = container.width / 2 - (img.width / 2) * scale;
  const dy = container.height / 2 - (img.height / 2) * scale;

  return {
    dx,
    dy,
    dWidth: img.width * scale,
    dHeight: img.height * scale,
  };
}

export function scaleToFit(
  img: { width: number; height: number },
  container: { width: number; height: number }
) {
  const scale = Math.min(container.width / img.width, container.height / img.height);
  const dx = container.width / 2 - (img.width / 2) * scale;
  const dy = container.height / 2 - (img.height / 2) * scale;

  return {
    dx,
    dy,
    dWidth: img.width * scale,
    dHeight: img.height * scale,
  };
}