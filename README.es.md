# NameFirst Pro

![Propuesta de icono Pro](./assets/brand/icon-128.png)

**Primero el nombre; pruebas en el momento de buscar.** Extensión independiente AGPL-3.0-only para Chrome/Edge de escritorio y Bing/Baidu, no un fork. `1.0.0-rc.1` es un candidato local pendiente de aprobación del icono y publicación. Aún no hay descarga pública. La interfaz está en chino simplificado; nueve README traducidos no implican nueve idiomas de interfaz.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

## Instalación y uso

1. En `release/1.0.0-rc.1/`, elegir el ZIP terminado en `chrome.zip` o `edge.zip`. Extraer todo en una carpeta permanente. `source.zip` contiene el código correspondiente, no la extensión para cargar.
2. Abrir `chrome://extensions` o `edge://extensions`, activar el modo desarrollador y cargar la carpeta extraída que contiene directamente `manifest.json`.
3. En la ventana de la extensión, activar los interruptores general/motor. Si se desea, elegir «开启联网核验权限» y leer la solicitud del navegador. Sin permiso no se consultan pruebas externas; se puede revocar.
4. Buscar, por ejemplo, `Apache Arrow official website` en resultados web normales. La tarjeta muestra estado, dirección exacta, fuentes y hora. Conserva los resultados originales y no redirige automáticamente.
5. Corregir búsquedas informativas con «这次查资料». Solo las etiquetas explícitas entrenan; omitir o no pulsar no entrena. Las direcciones, alias y rechazos personales no certifican identidad oficial.
6. Exportar JSON desde la gestión. En otro navegador, seleccionar el archivo, previsualizar combinación/sustitución y confirmar. Los conflictos conservan lo local; formatos desconocidos no sobrescriben. Permisos, preferencias, caché y deshacer no se migran.
7. Hacer copia antes de actualizar, sustituir los archivos extraídos, recargar la extensión y actualizar las pestañas. No desinstalar primero: se borran los datos locales.

Más detalles: [instalación en inglés](./INSTALL.en.md), [gestión](./MANAGEMENT.md), [privacidad](./PRIVACY.md). Hay edición, borrado, deshacer un cambio y protección de borradores concurrentes.

## Alcance y límites

No se requiere que el nombre esté en un catálogo instalado. La única política positiva de autoridad actual cubre páginas de inicio/descarga indicadas explícitamente por el directorio de proyectos Apache. Wikidata aporta pistas. Posición, HTTPS, declaraciones propias, puntuación del modelo o preferencia personal no bastan para certificar. No hay política general de documentación/inicio de sesión ni garantía universal de sitios, seguridad o acreditación.

Solo diseños reconocidos de Bing HTTPS `/search` y `www.baidu.com/s` UTF-8 de escritorio. CAPTCHA, acceso restringido, diseños ocultos/desconocidos, límites y tiempos agotados detienen o dejan sin conclusión, sin eludir controles. Por petición del usuario, la aceptación normal en línea no es condición de esta etapa. Aprendizaje/preguntas se pueden desactivar. No se guarda un historial completo; las pruebas históricas son caché y un fallo no renueva su fecha.

[Evaluación](./EVALUATION.md): 36 consultas redactadas manualmente con nombres reales; modelo entrenado con 25 aciertos, 6 abstenciones y 5 consultas informativas activadas erróneamente. De 24 escenarios sintéticos, 23 estados esperados; 0 certificaciones falsas entre 3 emitidas. Un caso documental se abstuvo de forma segura sin alcanzar la meta. No estima tráfico real ni precisión de toda la web.

## Desarrollo y licencia

Node.js 24+ / pnpm 11.25.0: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`. El empaquetado requiere además Git/Python 3.9+, `pnpm release:prepare` y `pnpm release:verify`. El usuario de los ZIP no necesita cuenta, API Key ni herramientas. Comparar con `SHA256SUMS`.

Código original y diseño Pro derivado autorizado en esta etapa: AGPL-3.0-only; dependencias con sus licencias. No se copia código, catálogo, identidad de extensión ni historial Git del antecesor. [Origen gráfico](./assets/brand/README.md) · [Notas](./RELEASE_NOTES.md) · [LICENSE](./LICENSE).
