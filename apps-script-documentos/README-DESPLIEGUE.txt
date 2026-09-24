SiMeCO₂ v109 · MOTOR DOCUMENTAL GOOGLE APPS SCRIPT

OBJETIVO
Este proyecto recibe desde SiMeCO₂ el diagnóstico consolidado de una sede y crea bajo demanda:
1. PDF Informe Detallado de Diagnóstico y Plan Inicial de Gestión Energética PGEE-UPME.
2. PDF Plan de Acción de Ahorro de Agua.
3. PDF Plan de Gestión y Uso Eficiente del Gas.
4. PDF Predimensionamiento Solar completo.
5. Google Sheets editable Plan de Reducciones GEI.
6. Carpeta privada en Drive con el expediente.
7. Envío de los 4 PDF por e-mail cuando el usuario selecciona “Crear y enviar por e-mail”.

DESPLIEGUE
1. Abre script.google.com y crea/abre el proyecto SiMeCO₂ que contiene el motor documental.
2. Sustituye Code.gs por el archivo Code.gs incluido aquí (o integra al final el bloque “SIMECO2 v109 · PUENTE DOCUMENTAL”).
3. En Configuración del proyecto activa “Mostrar el archivo de manifiesto appsscript.json”.
4. Sustituye appsscript.json por el incluido en esta carpeta.
5. Servicios -> añade Google Drive API v3 si todavía no aparece habilitada.
6. Implementar -> Nueva implementación -> Aplicación web.
7. Ejecutar como: usuario que implementa.
8. Acceso: según la política de tu organización. Para el portal público se requiere que los usuarios autorizados puedan invocar la Web App.
9. Autoriza Drive, Docs, Sheets y envío de correo.
10. Copia la URL terminada en /exec.
11. En SiMeCO₂: Informe por sede -> Plan de Acción Ambiental -> Centro documental -> Configuración del motor Google Apps Script -> pega la URL /exec.

IMPORTANTE
- La URL se guarda solo en el navegador mediante localStorage.
- El correo destinatario debe ingresarse antes de enviar.
- El consentimiento de generación/almacenamiento es obligatorio; la autorización GSV es opcional.
- La generación usa los históricos SiMeCO₂ como línea base mensual. Los documentos siguen siendo preliminares y no sustituyen auditoría, certificación o diseño definitivo.

CONTROL DE ABUSO
El puente v109 incluye un límite de 200 expedientes/día a nivel global y 8 por destinatario/día para proteger Drive y la cuota de correo. Estos valores pueden ajustarse en Code.gs.
