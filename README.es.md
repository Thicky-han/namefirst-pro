# NameFirst Pro

![Icono Pro azul](./assets/brand/icon-128.png)

**Primero el nombre; pruebas en el momento de buscar.** NameFirst Pro es una extensión independiente de código abierto para Chrome/Edge de escritorio. Detecta si una búsqueda en Bing/Baidu busca una entrada oficial, descubre candidatos incluso para nombres ausentes de un catálogo instalado y, con permiso, examina pruebas públicas actuales. La licencia **AGPL-3.0-only** permite uso comercial bajo sus condiciones.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

**Primera versión: `1.0.0`, con la identidad azul aprobada.** Obtén los paquetes en las [Releases oficiales](https://github.com/Thicky-han/namefirst-pro/releases). Si aún no aparece `v1.0.0`, la publicación sigue pendiente de la confirmación final del responsable y los paquetes todavía no están disponibles. El ZIP de fuentes no se instala directamente. **La interfaz está en chino simplificado**; nueve README traducidos no implican nueve idiomas de interfaz.

## Funciones

- Cada búsqueda compatible recibe una inferencia local: buscar una entrada, consultar información o incertidumbre. No hace falta registrar antes el nombre.
- Las tareas de navegación recopilan candidatos y pruebas actuales dentro de un presupuesto limitado. La tarjeta muestra dirección exacta, propósito, fuentes, hora y estado; puede abstenerse si faltan pruebas.
- Mantiene los resultados originales, sin redirección, descarga ni ejecución automática.
- Solo los comentarios explícitos entrenan el modelo local de intención. Las URL, alias y exclusiones personales se separan de la atribución oficial.
- Edición, borrado, deshacer el último cambio y copias JSON con vista previa antes de combinar/sustituir; migración manual entre Chrome y Edge.

## Descargar e instalar

Los usuarios del ZIP listo para cargar no necesitan Node.js, cuenta, clave API, servidor del proyecto ni compilar.

1. En [Releases](https://github.com/Thicky-han/namefirst-pro/releases), abre la versión oficial `v1.0.0`. Para Chrome elige `namefirst-pro-1.0.0-chrome.zip`; para Edge, `namefirst-pro-1.0.0-edge.zip`. `namefirst-pro-1.0.0-source.zip` contiene el código fuente correspondiente.
2. Extrae **todos los archivos** a una carpeta permanente. No cargues desde el ZIP ni borres la carpeta después de instalar.
3. Abre `chrome://extensions` o `edge://extensions`, activa el modo desarrollador y selecciona cargar una extensión descomprimida.
4. Selecciona la carpeta que **contiene directamente `manifest.json`**, no su carpeta superior. Comprueba que **NameFirst Pro** se haya cargado y fija el icono NF/PRO azul en la barra si lo deseas.
5. En la ventana de la extensión, activa el interruptor general y el del motor deseado. Para consultar pruebas externas, elige «开启联网核验权限», lee la solicitud del navegador para acceder a sitios HTTPS y autoriza. El permiso es revocable; antes de concederlo no se leen pruebas externas.
6. En una búsqueda web normal de Bing/Baidu de escritorio, prueba `Apache Arrow official website`. Lee **el estado actual, la entrada exacta, las fuentes y la hora**. Solo las pruebas de esa tarea que satisfagan la política respaldan una atribución oficial. Un nombre desconocido también entra en el proceso de descubrimiento, sin garantía de certificación.

Consulta la [guía detallada en inglés](./INSTALL.en.md) o [en chino simplificado](./INSTALL.md).

## Comentarios, copias y actualización

Si una consulta informativa activa la navegación, elige «这次查资料». «我在找入口» indica que buscas una entrada. «仅本次按入口核验» solo confirma esta tarea, sin guardar una etiqueta de entrenamiento. Omitir o no pulsar no entrena. Aprendizaje y preguntas pueden desactivarse por separado; las direcciones personales siguen claramente sin certificar.

Abre la gestión con «管理记录、查看历史证据与备份迁移» y exporta con «导出 JSON 备份». En otro navegador selecciona el archivo y combinar/sustituir, pulsa «预览导入», revisa registros y conflictos y confirma. Combinar conserva los registros locales en conflicto; sustituir sobrescribe datos personales y de aprendizaje. Permisos, preferencias, pruebas históricas y deshacer quedan fuera y deben configurarse aparte. Los formatos desconocidos o dañados no sobrescriben los datos existentes. Las copias contienen nombres/URL introducidos voluntariamente: guárdalas en privado.

Antes de actualizar, haz una copia, extrae toda la versión nueva y sustituye los archivos cargados. Recarga la extensión desde su página de gestión y actualiza las pestañas de búsqueda. Sustituir archivos en disco puede dejar activo el proceso anterior. **No desinstales primero:** borra los datos locales. Mantener la identidad de extensión y el perfil normalmente los conserva, sin garantía para todos los formatos futuros.

Si falta la tarjeta, revisa URL/diseño compatible, interruptores y actualización de pestañas tras un cambio. Si falla la verificación, revisa permiso externo, red y motivo mostrado. CAPTCHA, inicio de sesión, límites y tiempo agotado provocan parada o abstención, sin eludir controles. También puedes pausar el motor o revocar el permiso. [Detalles de gestión](./MANAGEMENT.md).

## Alcance y privacidad

La única política de autoridad que actualmente permite una atribución positiva cubre las **entradas de inicio/descarga** indicadas explícitamente en el directorio de proyectos mantenido por Apache. Wikidata solo aporta pistas. Posición, HTTPS, declaraciones propias, puntuación del modelo y preferencia personal no bastan para probar identidad oficial. No hay política genérica para documentación/inicio de sesión ni garantía sobre toda la web, seguridad del software o acreditación legal.

Solo se admiten diseños reconocidos de Bing HTTPS `/search` (`www.bing.com`, `cn.bing.com`, `bing.com`) y `www.baidu.com/s` con resultados web UTF-8 de escritorio. Móvil, imágenes/noticias y diseños ocultos/desconocidos quedan fuera. Por petición del responsable, la aceptación habitual en línea real no es condición de esta etapa; las pruebas controladas del navegador y las observaciones históricas en línea se informan por separado.

Sin telemetría, entrenamiento remoto, envío automático de comentarios ni historial completo de búsquedas. Etiquetas explícitas y registros personales permanecen locales. Tras autorizar, los sitios consultados pueden ver IP y URL solicitada; el descubrimiento adicional puede enviar nombres relacionados al motor de búsqueda. Por ello no es totalmente sin conexión ni anónimo en la red. Las pruebas antiguas son siempre caché; un fallo al renovarlas no actualiza su fecha. Cada tarea de navegación recoge pruebas actuales. [Privacidad](./PRIVACY.md) · [Aprendizaje](./LEARNING.md).

[Evaluación pública](./EVALUATION.md): en 36 consultas redactadas manualmente con nombres reales de software, el modelo ya entrenado acertó 25, se abstuvo en 6 y activó erróneamente navegación para 5 consultas informativas. En 24 casos sintéticos de confianza, 23 coincidieron con el estado esperado; ninguna de las 3 certificaciones fue falsa. Un caso documental se abstuvo con seguridad, pero no alcanzó la meta funcional. No son una muestra de usuarios reales ni una estimación de precisión para toda la web.

## Desarrollo y licencia

Node.js 24+ y pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

El empaquetado también necesita Git, Python 3.9+, `pnpm release:prepare` y `pnpm release:verify`. Compara archivos con `SHA256SUMS` y `Get-FileHash -Algorithm SHA256 <nombre-del-archivo>`. Coincidir no garantiza seguridad.

Implementación e historial Git independientes. El icono Pro azul, derivado autorizado del motivo NF/flecha original, está aprobado. El código original y este derivado gráfico usan AGPL-3.0-only; las dependencias conservan sus licencias. [Origen gráfico](./assets/brand/README.md) · [Dependencias](./DEPENDENCIES.md) · [LICENSE](./LICENSE) · [Notas de versión](./RELEASE_NOTES.md) · [Contribuir](./CONTRIBUTING.md).
