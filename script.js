document.addEventListener('DOMContentLoaded', () => {
  try {
    const menuButton = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('.primary-nav');

    const closeMenu = () => {
      if (!menuButton || !navigation) return;
      menuButton.classList.remove('active');
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
    };

    if (menuButton && navigation) {
      menuButton.addEventListener('click', () => {
        const isOpen = navigation.classList.toggle('open');
        menuButton.classList.toggle('active', isOpen);
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      });

      navigation.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
      });

      document.addEventListener('click', (event) => {
        if (!navigation.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
      });

      window.addEventListener('resize', () => {
        if (window.innerWidth > 860) closeMenu();
      });
    }
  } catch (error) {
    console.error('Navigation init failed:', error);
  }

  try {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        let target = null;
        try {
          target = document.querySelector(href);
        } catch {
          return;
        }

        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  } catch (error) {
    console.error('Smooth scroll init failed:', error);
  }

  try {
    const revealElements = document.querySelectorAll('.reveal');

    const showAllReveals = () => {
      revealElements.forEach((element) => {
        element.classList.add('visible');
      });
    };

    if (!('IntersectionObserver' in window)) {
      showAllReveals();
    } else {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -30px 0px',
        }
      );

      revealElements.forEach((element) => {
        revealObserver.observe(element);
      });
    }
  } catch (error) {
    console.error('Reveal init failed:', error);
    document.querySelectorAll('.reveal').forEach((element) => {
      element.classList.add('visible');
    });
  }

  try {
    document.querySelectorAll('[data-year]').forEach((item) => {
      item.textContent = new Date().getFullYear();
    });
  } catch (error) {
    console.error('Year stamp init failed:', error);
  }

  try {
    const ambientLights = document.querySelectorAll('.ambient');
    if (ambientLights.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.addEventListener(
        'pointermove',
        (event) => {
          const x = (event.clientX / window.innerWidth - 0.5) * 18;
          const y = (event.clientY / window.innerHeight - 0.5) * 18;
          if (ambientLights[0]) ambientLights[0].style.transform = `translate(${x}px, ${y}px)`;
          if (ambientLights[1]) ambientLights[1].style.transform = `translate(${-x}px, ${-y}px)`;
        },
        { passive: true }
      );
    }
  } catch (error) {
    console.error('Ambient effect init failed:', error);
  }
});
