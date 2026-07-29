if(!customElements.get('hero-slider')) {
  class HeroSlider extends HTMLElement {
    constructor() {
      super();

      if (Shopify.designMode) {
        window.addEventListener('shopify:section:load', e => {
          this.mountSlider();
        });
      }

      this.mountSlider();

      window.addEventListener('shopify:block:select', e => {
        const selectedSlideIndex = +e.target.dataset.index;
        this.slider.slideTo(selectedSlideIndex, 600);
      });
    }

    mountSlider() {
      const autoplayOptions = {
        delay: this.dataset.autoplayInterval
      };

      this.slider = new Swiper(this, {
        effect: 'fade',
        rewind: true,
        slidesPerView: 1,
        speed: 600,
        followFinger: false,
        navigation: {
          nextEl: '.swiper-button--next',
          prevEl: '.swiper-button--prev'
        },
        pagination: {
          el: ".swiper-pagination",
          clickable: true,
          renderBullet: function (i, className) {
            return `
            <button class="${className}">
              <span>0${i + 1}</span>
              <svg class="square-progress" width="26" height="26">
                <rect class="square-origin" width="26" height="26" rx="5" ry="5" />
              </svg>
              <svg class="progress" width="18" height="18" style="inset-inline-start: ${0 - ((i * 2.4) + 3.4)}rem">
                <circle class="circle-origin" r="8" cx="9.5" cy="9.5"></circle>
              </svg>
            </button>
            `;
          }
        },
        autoplay:
          this.dataset.autoplay === 'true' ? autoplayOptions : false,
        on: {
          init: this.handleSlideChange.bind(this),
          slideChange: this.handleSlideChange.bind(this)
        }
      });
    }

    handleSlideChange(swiper) {
      let headerInner = document.querySelector('.header__inner');
      let heroInners = document.querySelectorAll('.hero__inner');

      if (!headerInner || !heroInners) {
        return;
      }

      // change --transparent-header-menu-text-color value on document style attributes
      document.documentElement.style.setProperty(
        '--transparent-header-menu-text-color',
        heroInners[swiper.activeIndex].dataset.headerMenuTextColor
      );
    }
  }
  customElements.define('hero-slider', HeroSlider);
}
