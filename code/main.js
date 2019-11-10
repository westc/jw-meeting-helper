(_ => {
  const RGX_CUSTOM_TEXT = /(\S+(?:[^\r\n]+\S+)*)(?:(?=\s)[^\r\n])+([1-9]\d*):(([1-9]\d*)(?:-([1-9]\d*)|(?:([^\S\r\n]*,[^\S\r\n]*)[1-9]\d*)+)?)/g;
  
  const BLANK_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';
  const BLANK_IMAGE = {
    cssSrc: YourJS.sub(
      "url('{text}'), url('{blank}')",
      {
        text: 'code/year-text.jpg',
        blank: BLANK_PIXEL
      }
    )
  };

  const LOCAL_STORAGE_EXISTS = 'undefined' !== typeof Storage && 'undefined' !== typeof localStorage;

  const NAME_CUSTOM_TEXTS = 'customTexts';

  let jFileInput = $('#fileInput');

  let isViewer = !!window.opener;

  let { head } = document;

  let myVue;

  function save(name, value) {
    if (LOCAL_STORAGE_EXISTS) {
      localStorage.setItem(name, value);
    }
    return LOCAL_STORAGE_EXISTS;
  }

  function load(name, opt_default) {
    if (LOCAL_STORAGE_EXISTS) {
      let result = localStorage.getItem(name);
      return result === null ? opt_default : result;
    }
    return opt_default;
  }

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

    $('body').addClass(isViewer ? 'is-viewer' : 'is-main');
    
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
        selectedVerse: null,
        customTexts: load(NAME_CUSTOM_TEXTS),
        customTextsList: []
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
          this.retrieveBook(book, _ => {
            this.selectedChapter = book.chapters[index];
          });
        },
        retrieveBook(book, onDone) {
          let arrArgs = YourJS.slice(arguments, 2);
          YourJS.poll(
            (prevent, callCount) => {
              let chapters = book.chapters;
              if (chapters.length > 0) {
                return arrArgs;
              }
              else if (callCount === 1) {
                head.appendChild(YourJS.dom({ _: 'script', src: `bible/bible-${bibleID}.book-${book.id}.js` }));
              }
            },
            onDone
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
          var input = e.target;
          var self = this;
          [].forEach.call(input.files, function(f) {
            var reader = new FileReader();
            reader.onload = function(e) {
              var images = self.images.slice(1);
              images.push({
                name: f.name,
                uri: e.target.result,
                canEdit: true,
                isProcessing: false
              });
              images.sort(function(a, b) { return YourJS.compareTitle(a.name, b.name); });
              self.images.splice.apply(self.images, [1, Infinity].concat(images));
            };
            reader.readAsDataURL(f);
          });
          input.value = input.defaultValue;
        },
        getImageCssSrc(image) {

          return image.cssSrc || YourJS.sub('url({uri})', { uri: image.uri });
        },
        rotate90(e, vueImage, rotations) {
          rotations = ((~~rotations || 0) % 4 + 4) % 4;

          vueImage.isProcessing = true;

          let canvas = YourJS.dom({ _: 'canvas' });
          let ctx = canvas.getContext('2d');
          let img = YourJS.extend(
            new Image(),
            {
              onload: function() {
                if (rotations % 2) {
                  canvas.width = img.height;
                  canvas.height = img.width;
                }
                else {
                  canvas.width = img.width;
                  canvas.height = img.height;
                }
                ctx.rotate(rotations * Math.PI / 2);
                ctx.translate(rotations < 2 ? 0 : -img.width, rotations % 3 ? -img.height : 0);
                ctx.drawImage(img, 0, 0);
                YourJS.extend(vueImage, {
                  uri: canvas.toDataURL(),
                  isProcessing: false
                });

                img = null;
                ctx = null;
                canvas = null;
              },
              src: vueImage.uri
            }
          );

          // Prevent the image from being shown.
          e.stopPropagation();
        },
        showImage(vueImage) {
          this.sendViewerData(vueImage);
        },
        removeImage(e, vueImage) {
          let {images} = this;
          let imageIndex = images.indexOf(vueImage);
          $(this.$refs.divImages[imageIndex]).tooltip('dispose');
          images.splice(imageIndex, 1);

          // Prevent the image from being shown.
          e.stopPropagation();
        },
        showVerse(verseIndex) {
          var book = this.selectedBook;
          var chapter = this.selectedChapter;
          this.sendViewerData({
            bookName: book.name,
            chapterNumber: +chapter.num,
            verseNumber: verseIndex + 1,
            text: chapter.verses[verseIndex]
          });
        },
        showCustomVerse(book, chapter, verse) {
          this.sendViewerData({
            bookName: book.name,
            chapterNumber: +chapter.num,
            verseNumber: verse.number,
            text: verse.text
          });
        },
        sendViewerData(data) {
          this.viewers.forEach(viewer => {
            if (!viewer.closed) {
              viewer.postMessage(data, '*');
            }
          });
        },
        updateCustomTextsList: YourJS.debounce(function () {
          const CTX_CUSTOM_TEXTS = this.TEXTS.tabs.bible.customTexts;

          let customTexts = this.customTexts;

          this.customTextsList = (YourJS.execAll(RGX_CUSTOM_TEXT, customTexts) || [])
            .map(([match, bookName, chapter, verses, verse1, vHyphen, vComma]) => {
              let result = { source: match };

              let rgxBookName = new RegExp(
                '^' + YourJS.deburr(bookName).replace(/\./g, '').replace(/\S+/g, '$&\\S*').replace(/\s+/g, '\\s+') + '$',
                'i'
              );

              let books = this.testaments.reduce(
                (carry, testament) => carry.concat(
                  testament.books.filter(
                    ({ name, abbr }) => rgxBookName.test(YourJS.deburr(name))
                      || rgxBookName.test(YourJS.deburr(abbr))
                  )
                ),
                []
              );

              if (books.length === 1) {
                let book = books[0];
                chapter = +chapter;
                verses = vHyphen
                  ? YourJS.span(+verse1, +vHyphen)
                  : vComma
                    ? verses.split(/\s*,\s*/).map(v => +v)
                    : [+verse1];

                if (chapter > book.chapterCount) {
                  result.error = CTX_CUSTOM_TEXTS.chapterCountExceeded;
                }
                else {
                  let objChapter = book.chapters[chapter - 1];
                  if (!objChapter) {
                    result.error = `${CTX_CUSTOM_TEXTS.openingBook}\t${book.name}`;
                    this.retrieveBook(book, _ => this.updateCustomTextsList());
                  }
                  else {
                    let arrVerses = objChapter.verses;
                    let objVerses = verses.reduce(
                      (carry, v) => {
                        let result = { number: v, text: arrVerses[v - 1] };
                        carry[result.text ? 'valid' : 'invalid'].push(result);
                        return carry;
                      },
                      { invalid: [], valid: [] }
                    );
                    if (objVerses.invalid.length) {
                      result.error = CTX_CUSTOM_TEXTS.invalidVerses
                        + '\t'
                        + book.name
                        + ' '
                        + chapter
                        + ':'
                        + objVerses.invalid.map(v => v.number).join(', ');
                    }
                    else {
                      result.book = book;
                      result.chapter = objChapter;
                      result.verses = objVerses.valid;
                    }
                  }
                }
              }
              else if (books.length === 0) {
                result.error = `${CTX_CUSTOM_TEXTS.bookNotFound}\t${bookName}`;
              }
              else {
                result.error = [CTX_CUSTOM_TEXTS.bookAbbrInvalid].concat(books.map(({ name }) => name)).join('\n- ');
              }

              if (result.error) {
                result.error = `${CTX_CUSTOM_TEXTS.errorStart}\t${match}\n\n${result.error}`;
              }

              return result;
            });

          save(NAME_CUSTOM_TEXTS, customTexts);
        }, 1000)
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
        },
        customTexts() {
          this.updateCustomTextsList();
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
              this.images = [data.uri ? data : BLANK_IMAGE];
              this.selectedVerse = null;
            }
          });
        }
        else {
          this.updateCustomTextsList();
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
