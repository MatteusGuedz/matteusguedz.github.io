const iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
const isPhone = navigator.platform.includes('iPhone');
const isAndroid = navigator.userAgent.includes('Android');

if (isAndroid) {
  document.body.classList.add('android');
}

document.addEventListener('player:play', e => {
  let player = e.detail.instance;

  if (isAndroid && !player.playsinline && player.type !== 'audio') {
    player.enterFullscreen();
  }
})

let projectNavEl = document.querySelector('.project-nav');

class Browser {
  constructor(element) {
    this.element = element;

    this.siteEl = document.body;
    this.pageEl = document.querySelector('.page');

    this.path = document.location.pathname;

    this.viewportEl = document.body;

    this.scrollable = {
      element: document.body
    };
    
    this.reactive = new Carbon.Reactive();

    if (isPhone) {
      window.addEventListener('orientationchange', this.onResize.bind(this), false);
    }
    
    if (!isPhone) {
      window.addEventListener('resize', this.onResize.bind(this), {
        passive: true
      });
    }

    window.addEventListener('scroll', this.onScroll.bind(this), {
      passive: true,
      capture: false
    });

    this.forcePhone = document.body.classList.contains('phone');

    this.onResize();

    contrastManager.browser = this;

    contrastManager.setup(document.body);

    window.addEventListener('focus', this.onFocus.bind(this), false);

    document.body.classList.remove('initializing');
  }

  get pageTransition() {
    return this.siteEl.classList.contains('reduce-motion') 
      ? PageTransitions.none
      : PageTransitions.default;
  }

  onFocus() {    
    this.onResize();
  }

  on(type, callback) {
    this.reactive.on(type, callback);
  }

  async load(path, options = { }) {    
    if (this.path == path && options.force !== true) {
      return;
    }
    
    this.path = path;
 
    let animate = options.animate !== false;

    let hyperpageRequest = app.getHyperpage(path);

    let pageEl = document.querySelector('.page');

    animate && await this.pageTransition.animateOut(pageEl);

    let hyperpage = await hyperpageRequest;

    if (hyperpage.properties) {
      document.title = hyperpage.properties.title;
    }

    let newEl = Carbon.DOM.parse(hyperpage.html);
    let blocksEl = pageEl.querySelector('.blocks');

    try {
      Carbon.DOM.beforeRemoval(blocksEl);
    }
    catch (err) {
      console.log('unload error', err);
    }

    blocksEl.innerHTML = newEl.querySelector('.blocks').innerHTML;

    if (projectNavEl && newEl.querySelector('.project-nav')) {
      projectNavEl.innerHTML = newEl.querySelector('.project-nav').innerHTML
    }

    pageEl.setAttribute('style', newEl.getAttribute('style'));

    pageEl.className = newEl.className;
    pageEl.classList.remove('loading')
    pageEl.id = newEl.id;

    browser.doResize();

    app.onDOMMutation();

    this.scrollTop = 0;

    contrastManager.setup(document.body);

    animate && await this.pageTransition.animateIn(pageEl);

    app.cursor && app.cursor.check();

    return true;
  }

  get background() {
    let style = window.getComputedStyle(this.pageEl);

    let background = new Background();

    background.image = style.backgroundImage;

    try {
      let bg = chroma(style.backgroundColor);
      
      background.color = (bg.alpha() == 0) ? chroma('#fff') : bg;
    }
    catch (err) { }

    
    return background;
  }
  
  async reload(options = { }) {
    if (options.animate === undefined) {
      options.animate = false;
    }

    if (options.force === undefined) {
      options.force = false;
    }

    await this.load(this.path, options);
  }

  get width() {
    return this.scrollable.element.clientWidth;
  }

  get height() {
    return this.scrollable.element.clientHeight;
  }

  get scrollTop() {
    var scrollingElement = document.scrollingElement || document.body;

    return scrollingElement.scrollTop;
  }

  set scrollTop(value) {

    var scrollingElement = document.scrollingElement || document.body;

    scrollingElement.scrollTop = value;
  }

  onScroll(e) {
    this.onScrollFrameRequest = window.cancelAnimationFrame(this.onScrollFrameRequest);
    
    this.onScrollFrameRequest = window.requestAnimationFrame(() => {
      let firstVisibleBlockEl = getFirstVisibleBlock();

      Navigation.instance && Navigation.instance.checkContrast(firstVisibleBlockEl);
  
      for (var visibleBlockEl of document.querySelectorAll('.block.visible')) {        
        Block.get(visibleBlockEl).onScroll(e);
      }

      this.setBrowserControlHeight();
    });
  }

  setBrowserControlHeight() {
    if (!iOS) return;

    let bottomHeight = window.outerHeight - window.innerHeight;

    document.body.style.setProperty('--browser-bar-height', bottomHeight + 'px'); 
  }

  onResize() {
    this.onResizeFrameRequest = window.cancelAnimationFrame(this.onResizeFrameRequest);

    this.onResizeFrameRequest = window.requestAnimationFrame(() => {
      let blocksEl = this.element.querySelector('.blocks');

      this.setBrowserControlHeight();
     
      if (!this.forcePhone) {
        let breakpoint = this.breakpointName;

        if (!document.body.classList.contains(breakpoint)) {
          this.forceBreakpoint(breakpoint);
        }
      }

      let value = blocksEl.offsetWidth < app.gridWidth ? (blocksEl.offsetWidth + 'px') : null;

      document.body.style.setProperty('--container-width', value); 

      this.doResize();
    });
  }

  forceBreakpoint(breakpointName) {

    if (document.body.classList.contains(breakpointName)) return;
    
    let isPhone = breakpointName === 'phone';
    
    // 3 = Hamburger
    let presetId = isPhone ? 3 : null;

    if (Navigation.instance && !Navigation.instance.isEmpty) {
      Navigation.instance.element.style.visibility = 'hidden';
      Navigation.instance.swap(presetId);
      Navigation.instance.element.style.visibility = null;
    
      this.navigationPresetOverride = presetId;
    }

    document.body.classList.toggle('phone', isPhone); 
    document.body.classList.toggle('desktop', !isPhone);
  
  }

  get breakpointName() {
    let bpw = 600;

    
    return window.innerWidth <= bpw ? 'phone' : 'desktop';
  }

  get isDesktop() {
    return !document.body.classList.contains('phone');
  }

  get isPhone() {
    return document.body.classList.contains('phone');
  }

  doResize() {
    for (let fittyEl of document.querySelectorAll('.fitty')) {
      fittyEl.fitty && fittyEl.fitty.fit();
    }
  }
}