$(document).ready(function () {
    $('a:not([target="_blank"]):not([href^="#"]):not([data-no-transition])').on('click', function (e) {
        var href = $(this).attr('href');

        if (href && !href.startsWith('http') && href !== '#' && !href.startsWith('javascript')) {
            e.preventDefault();

            $('.page-content').css({
                'opacity': '0',
                'transform': 'translateY(-10px)',
                'transition': 'all 0.25s ease-in'
            });

            setTimeout(function () {
                window.location.href = href;
            }, 250);
        }
    });
});