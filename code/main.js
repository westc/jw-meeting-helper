(_ => {
  const BLANK_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';
  const BLANK_IMAGE = { src: `url('code/year-text.jpg'), url('${BLANK_PIXEL}')` };

  let jFileInput = $('#fileInput');

  let isViewer = !!window.opener;

  let { head } = document;

  let myVue;

  init = function(initOptions) {
    let { translations } = initOptions;

    let { bibleID } = translations;

    if (!isViewer) {
      head.appendChild(YourJS.dom({ _: 'script', src: `bible/bible-${bibleID}.index.js` }));
    }

    if (YourJS.hasAt(translations, ['tabs', 'images', 'choose'])) {
      YourJS.css({
        '.custom-file-label::after': {
          content: `"${translations.tabs.images.choose}"`
        }
      });
    }
    
    myVue = new Vue({
      el: '#myVue',
      data: {
        images: [],
        isViewer,
        viewers: [],
        testaments: [],
        TEXTS: translations,
        selectedBook: null,
        selectedChapter: null,
        selectedVerse: null
      },
      computed: {
        selectedVerseText() {
          return `${this.selectedVerse.bookName} ${this.selectedVerse.chapterNumber}:${this.selectedVerse.verseNumber}`;
        }
      },
      methods: {
        unsetBook() {
          this.selectedBook = null;
        },
        unsetChapter() {
          this.selectedChapter = null;
        },
        viewBook(book) {
          this.selectedBook = book;
        },
        viewBookChapter(num) {
          let index = num - 1;
          let book = this.selectedBook;
          YourJS.poll(
            (prevent, callCount) => {
              let result = book.chapters[index];
              if (!result && callCount === 1) {
                head.appendChild(YourJS.dom({ _: 'script', src: `bible/bible-${bibleID}.book-${book.id}.js` }));
              }
              return result;
            },
            chapter => {
              this.selectedChapter = chapter;
            }
          );
        },
        getTextFor(path) {
          return this.TEXTS[path];
        },
        showYearText() {
          this.showImage(this.images[0]);
        },
        addViewer() {
          this.viewers.push(window.open(location.href, '_blank'));
        },
        closeViewers() {
          this.viewers.forEach(viewer => viewer.close());
        },
        onFilesSelected(e) {
          let input = e.target;
          [].forEach.call(input.files, f => {
            let reader = new FileReader();
            reader.onload = e => {
              let images = this.images.slice(1);
              images.push({ name: f.name, src: `url(${e.target.result})` });
              images.sort((a, b) => YourJS.compareTitle(a.name, b.name));
              this.images.splice.apply(this.images, [1, Infinity].concat(images));
            };
            reader.readAsDataURL(f);
          });
          input.value = input.defaultValue;
        },
        showImage(image) {
          this.viewers.forEach(viewer => {
            if (!viewer.closed) {
              viewer.postMessage(image, '*');
            }
          });
        },
        showVerse(verseIndex) {
          let book = this.selectedBook;
          let chapter = this.selectedChapter;
          let data = {
            bookName: book.name,
            chapterNumber: +chapter.num,
            verseNumber: verseIndex + 1,
            text: chapter.verses[verseIndex]
          };
          this.viewers.forEach(viewer => {
            if (!viewer.closed) {
              viewer.postMessage(data, '*');
            }
          });
        }
      },
      watch: {
        images() {
          document.title = this.isViewer
            ? this.selectedVerse
              ? this.selectedVerseText.replace(/[^]+/, this.TEXTS.viewerTitleTemplate)
              : (this.images[0] && this.images[0].name)
                ? this.images[0].name.replace(/[^]+/, this.TEXTS.viewerTitleTemplate)
                : this.TEXTS.viewerYearTextTitle
            : this.TEXTS.title;
        }
      },
      mounted: function() {
        if (this.isViewer) {
          window.addEventListener('message', ({ data }) => {
            // Interpret as a verse...
            if (data.verseNumber) {
              this.selectedVerse = data;
              this.images = [];
            }
            // Interpret as an image...
            else {
              this.images = [data.src ? data : BLANK_IMAGE];
              this.selectedVerse = null;
            }
          });
        }
        this.images = [BLANK_IMAGE];
      },
      updated: function() {
        if (this.selectedVerse) {
        }
        $('.has-tooltip')
          .tooltip({ trigger : 'hover' })
          .filter('.bible-selector')
              .on('click', function () {
                $(this).tooltip('dispose');
              });
      }
    });
  };

  initBible = function(inTestaments) {
    let testaments = myVue.testaments;
    inTestaments.forEach(testament => {
      testament.books.forEach(book => {
        book.chapters = [];
      });
    });
    testaments.push.apply(testaments, inTestaments);
  };

  initBibleBook = function(bookID, chapters) {
    myVue.testaments.reduce((books, testament) => {
      return testament.books.reduce((books, book) => {
        return YourJS.extend(books, { [book.id]: book });
      }, books);
    }, {})[bookID].chapters = chapters;
  };

  function maximizeFontSize(elem, opt_dontApplyFontSize) {
    var canBeBigger, isNotTooMany,
        iters = 0,
        doc = elem.ownerDocument,
        nextSibling = elem.nextSibling,
        newFontSize = 0.5,
        diff = 0.5,
        fontSize = elem.style.fontSize,
        display = elem.style.display;

    elem.style.display = 'block';

    do {
      newFontSize += diff;
      elem.style.fontSize = newFontSize + 'px';
      if (canBeBigger = (elem.scrollWidth <= elem.offsetWidth && elem.scrollHeight <= elem.offsetHeight)) {
        diff *= 2;
      }
      else {
        newFontSize -= diff;
        diff /= 2;
      }
      isNotTooMany = iters++ < 99;
    } while((!canBeBigger || diff >= 0.5) && isNotTooMany);

    elem.style.display = display;

    if (!isNotTooMany || opt_dontApplyFontSize) {
      elem.style.fontSize = fontSize;
    }

    return isNotTooMany ? newFontSize : undefined;
  }

  // Close all viewers as you are leaving or reloading the page
  $(window).on('beforeunload', e => {
    myVue.closeViewers();
  });
})();
