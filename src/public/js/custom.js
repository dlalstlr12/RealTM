$(function () {
    $(".slide").slick({
        infinite: true,
        dots: false,
        arrows: false,
        autoplay: true,
        autoplaySpeed: 2000,
        fade: true,
        speed: 1000,
        pauseOnHover: false,
    });

    new TypeIt("#typing", {
        speed: 160,
        waitUntilVisible: true,
        loop: false,
    })
        .type("언제 어디서든 협업하세요.")
        .pause(100)
        .move(-6)
        .pause(500)
        .type("소통하고 ")
        .move(6)
        .go();

    $(".trigger").click(function () {
        $(this).toggleClass("active");
        $(".menu").toggleClass("active");
    });
    $(".menu a, .welcome, .logo").click(function () {
        $(".menu, .trigger").removeClass("active");
    });
});
