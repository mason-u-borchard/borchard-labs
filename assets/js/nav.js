/* Navigation: scroll shadow, mobile menu, active link highlighting */

(function () {
    var nav = document.getElementById('siteNav');
    var toggle = document.getElementById('navToggle');
    var mobileNav = document.getElementById('mobileNav');

    // Add shadow on scroll
    window.addEventListener('scroll', function () {
        if (window.scrollY > 10) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    toggle.addEventListener('click', function () {
        toggle.classList.toggle('open');
        mobileNav.classList.toggle('open');
    });

    // Close mobile menu on link click
    var mobileLinks = mobileNav.querySelectorAll('a');
    for (var i = 0; i < mobileLinks.length; i++) {
        mobileLinks[i].addEventListener('click', function () {
            toggle.classList.remove('open');
            mobileNav.classList.remove('open');
        });
    }

    // Highlight active nav link based on current path
    var path = window.location.pathname;
    var navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');
    for (var j = 0; j < navLinks.length; j++) {
        var href = navLinks[j].getAttribute('href');
        if (path === href || (href !== '/' && path.indexOf(href) === 0)) {
            navLinks[j].classList.add('active');
        }
    }
})();
