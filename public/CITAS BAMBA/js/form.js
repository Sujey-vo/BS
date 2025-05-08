document.querySelector('#submit').addEventListener('click',function(){

    let cliente = document.querySelector('#cliente').value;
    let fecha = document.querySelector('#fecha').value;
    let hora = document.querySelector('#hora').value;
    let tecnico = document.querySelector('#tecnico').value;
    let servicio = document.querySelector('#servicio').value;
    let servicio2 = document.querySelector('#servicio2').value;
    let servicio3 = document.querySelector('#servicio3').value;
    let url = "https://api.whatsapp.com/send?phone=522721070790&text=*_BAMBA STUDIO_*%0A*Reservas*%0A%0A*¿Cual es tu nombre?*%0A" + cliente + "%0A*Indica la fecha de tu reserva*%0A" + fecha + "%0A*Indica la hora de tu reserva*%0A" + hora + "%0A*Tecnico de Preferencia*%0A" + tecnico + "%0A*¿Cual es el servicio que se desea realizar?*%0A" + servicio + "%0A*¿Cual es la forma que se deseas?*%0A" + servicio2 + "%0A*¿Cual es largo que se deseas?*%0A" + servicio3;
    window.open(url);

});
