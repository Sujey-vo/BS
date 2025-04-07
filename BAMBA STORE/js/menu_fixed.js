$(document).ready(function(){
	var altura = $('.menu').offset().top;

	$(window).on('scroll', function(){
		if ( $(window).scrollTop() > altura){
			$('.menus').addClass('menu-fixed');
		} else {
			$('.menus').removeClass('menu-fixed');
		}
	});
});