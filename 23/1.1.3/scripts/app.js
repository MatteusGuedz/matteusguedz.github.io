let page = null;
let lazyLoader = new Carbon.LazyLoader();

class App {  
  constructor() {
    this.router = new Carbon.Router({
      '/'       : new Page('home', this),
      '/{slug}' : new Page('*', this)
    });

    this.router.beforeNavigate = this.beforeNavigate.bind(this);
      
    let bodyStyle = getComputedStyle(document.body);

    this.gridWidth = parseInt(bodyStyle.getPropertyValue('--grid-width'));
  
    this.hyperpages = { };

    history.scrollRestoration = 'manual';
  }

  async start() {
    if (!browser.isPhone && browser.breakpointName === 'phone') {
      var navigationEl = document.querySelector('.navigation');

      if (navigationEl.getAttribute('on-insert')) {
        this.navigation = new Navigation(navigationEl);

        navigationEl.removeAttribute('on-insert');
      }

      browser.forceBreakpoint('phone');
    }

    this.onDOMMutation();

    this.router.start();

    Navigation.instance.check();

    let pageEl = document.querySelector('.page');

    pageEl.classList.remove('loading');
    pageEl.classList.add('loaded');    

    setTimeout(() => {
      pageEl.classList.remove('loaded');
    }, 1000);

    await this.hyperInit();
  }

  async hyperInit() {
    for (var el of document.querySelectorAll('a')) {
      let url = el.getAttribute('href');

      if (url.startsWith('/') && url != '/') {
        let result = await this.fetchHyperpage(url, true); 
        
        this.hyperpages[result.url] = result;
      }
    }
  }

  async hyperloadImages(hyperpage) {
    if (hyperpage.img) return;

    hyperpage.img = true;

    let accept = 'text/html';

    if (webpSupport) {
      accept += ',image/webp';
    }

    // SKIP
  }

  async logView(url) {
    await fetch(url, { 
      credentials: 'same-origin',
      headers: {
        'Accept': 'text/html',
        'x-hit-only': '1'
      }
    });

    console.log('Logged hit')
  }

  async getHyperpage(url) {
    var hyperpage = this.hyperpages[url];

    if (hyperpage) {

      if (hyperpage.viewCount < 2) {
        this.logView(url);
      }

      console.log('using hyperpage');

      hyperpage.viewCount++;

      this.hyperloadImages(hyperpage);
      
      return hyperpage;
    }
    else {
      console.log('fetching hyperpage');

      hyperpage = await this.fetchHyperpage(url, false);

      hyperpage.url = url;
      hyperpage.viewCount++;

      this.hyperpages[url] = hyperpage;

      this.hyperloadImages(hyperpage);

      return hyperpage;
    }
  }

  async fetchHyperpage(url, preload) {
    let headers = {
      'Accept': 'text/html',
      'x-partial': 'true',
      'x-viewport-width': window.screen.width.toString()
    }

    if (preload) {
      headers['x-preload'] = '1'
    }

    var response = await fetch(url, { 
      headers: headers
    });

    var properties = { }

    try {
      properties = JSON.parse(response.headers.get("x-properties"));
    }
    catch(err) { }

    return {
      url: url,
      properties: properties,
      html: await response.text(),
      viewCount: 0
    };
  }

  onDOMMutation(mutations) {
    Carbon.DOM.onChange();

    contrastManager.check();
    
    lazyLoader.setup();
  }

  beforeNavigate(e) {   
    if (e.url == document.location.pathname) { // same
      if (Navigation.instance && Navigation.instance.isOpen) {
        Navigation.instance.close();
      }
      else {
        // TODO: Enumulate smooth scrolling on Safari
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      return false;
    }

    if (e.clickEvent && e.clickEvent.target.closest('a')) {
      if (e.clickEvent.target.closest('.block.active') || 
          e.clickEvent.target.closest('a').hasAttribute('disabled')) {
        return false;
      }
    }
    
    if (!e) return;

    let target = e.target;

    if (!target) return;

    selectLink(target.pathname);
    
    return true;
  }

  navigate(path) {
    this.router.navigate(path);
  }

  load(cxt) {
    this.path = cxt.url;
    
    if (cxt.init) {
      this.onLoaded();

      return Promise.resolve(true);
    }

    return this._load(cxt.url, true);
  }

  async _load(path, notify) {
    let same = path == this.path;

    this.path = path;

    if (Navigation.instance && Navigation.instance.isOpen) {
      await Navigation.instance.close();
    } 

    if (!same) {
      browser.load(path, notify);
    }
  }
}

function selectLink(pathname) {
  for (var activeLinkEl of document.querySelectorAll('a.active')) {
    activeLinkEl.classList.remove('active');
  }

  let linkEls = document.querySelectorAll(`a[href='${pathname}']`);

  for (var linkEl of linkEls) {
    if (linkEl.firstElementChild && linkEl.firstElementChild.tagName == 'H1') {
      continue;
    }

    linkEl.classList.add('active');
  }
}

selectLink(document.location.pathname);

Carbon.ActionKit.observe('click', 'change');

class Page {
  async load(cxt) {        
    if (cxt.init) return; // Skip animation on initial page load

    await app._load(cxt.path);
  }

  unload(cxt) {
    return true;
  }
}


const app = new App();

let browser = new Browser(document.body);

app.start();

Carbon.controllers['browser'] = browser;

if ('ontouchstart' in window) {
  app.cursor = null;
}
else {
  document.body.classList.add('custom-cursor');
  
  app.cursor = Carbon.Cursor.create({ blendMode: 'none', scale: 0.7, type: 'zoom-in' });

  app.cursor.start();
}

app.lightbox = Carbon.Lightbox.get({ 
  cursor: app.cursor, 
  zoomInDuration: 200,
  zoomInEasing: 'easeOutQuad',
  zoomOutDuration: 200,
  zoomOutEasing: 'easeOutQuad',
  slideDuration: 300,
  slideEasing: 'cubic-bezier(0.250, 0.460, 0.450, 0.940)', // ease-out-quad (css)
  topEdgeCarveOutForClose: 60, // PX if > 1, otherwise %
  flipperCarveOut: 0.3
});

app.lightbox.getCaption = function(slide) {
  let captionEl = slide.item.sourceElement.querySelector('.caption');
    
  if (captionEl && captionEl.innerHTML.length > 0) {
    return `<div class="caption">${captionEl.innerHTML}</div>`;
  }

  return null;
};

app.lightbox.reactive.on('slideCreated', e => { 
  var slide = e.slide;

  let captionEl = slide.element.querySelector('.caption');

  if (captionEl && captionEl.innerHTML.length > 0) {
    slide.element.classList.add('captioned');
  }

  slide.fit(app.lightbox);
});

// NOTE: zoom-in and zoom-out use anime

app.lightbox.reactive.on('open', e => {  
  let blockEl = e.item.sourceElement.closest('.block');

  let bgColor = contrastManager.background.color;
  let fgColor = contrastManager.background.color;

  if (blockEl) {
    let surface = Surface.get(blockEl);

    bgColor = surface.compositedBg;
    fgColor = surface.compositedColor;
  
    if (getContrast(bgColor, fgColor) < contrastManager.minContrast) {
      fgColor = adjustColor(bgColor, fgColor); 
    }

    app.lightbox.isSlideshow = blockEl.querySelectorAll('carbon-item').length > 0 && !blockEl.querySelector('carbon-player');
  }

  e.element.style.setProperty('--background-color', bgColor.hex());
  e.element.style.setProperty('--color', fgColor.hex());
});

app.lightbox.reactive.on('closing', async e => {
  if (app.cursor) {
    lightbox.slide.item.showSource();

    app.cursor.check();

    lightbox.slide.item.hideSource();
  }

  e.element.style.setProperty('--background-color', null);
});

app.lightbox.reactive.on('panStart', async e => {  
  document.body.classList.add('panning-lightbox');
});

app.lightbox.reactive.on('panEnd', async e => {  
  document.body.classList.remove('panning-lightbox');
});

Carbon.Lightbox.prototype.getItem = function(index) { 
  let gridEl = lightbox.slide.item.sourceElement.closest('carbon-grid');
  
  let el = gridEl.querySelector(`[data-index='${index}']`);

  if (el) { 
    el = el.querySelector('carbon-image') || el.firstElementChild; 
  }

  return el ? new Carbon.LightboxItem(el) : null;
}