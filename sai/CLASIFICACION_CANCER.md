# Criterio de clasificación del estadístico

En **Dashboard interactivo → Diagnóstico**, la tabla agrupa los textos originales en categorías reconocibles y conserva las columnas de **Registros**, **Pacientes**, **%**, **Con monto**, **Monto total del servicio** y **Ticket promedio**. Registros cuenta atenciones; Pacientes cuenta nombres únicos dentro de cada categoría. El porcentaje usa el total de registros del desglose.

## Decisiones de agrupación

| Categoría del reporte | Diagnósticos que reúne |
| --- | --- |
| Mama | Mama, seno y variantes mamarias. |
| Colón | Tumores primarios de colon. |
| Recto / colorrectal | Recto, colorrectal y menciones conjuntas de colon y recto. |
| Pulmón | Pulmón y bronquios. |
| Páncreas | Páncreas y variantes pancreáticas. |
| Ovario | Ovario, separado del resto ginecológico como en la imagen. |
| Ginecológico | Cérvix, útero, endometrio, trompas, vagina y vulva. |
| Genitourinario masculino | Próstata, pene y testículo se muestran como diagnósticos separados. |
| Riñón | Parénquima renal y riñón. |
| Vías urinarias | Vejiga, urotelio, uréter, uretra y pelvis renal. |
| Gástrico / esófago | Estómago y esófago, como en la imagen. |
| Vías biliares / vesícula | Colangiocarcinoma, conductos biliares y vesícula. |
| Sarcomas | Sarcomas de tejido blando, hueso y sarcomas con órgano mencionado. |
| Hematológico | Leucemia, linfoma y mieloma se muestran como diagnósticos separados. |
| Otros grupos | Tiroides, sistema nervioso central, cabeza y cuello, piel, hígado, tubo digestivo restante, tórax, endocrino y ojo. |

Los diagnósticos de **sitios múltiples** que no permiten reconocer un tumor primario conservan su texto original en la tabla. Los carcinomas sin órgano indicado se agrupan por tipo histológico sin inventar un sitio. Un cáncer metastásico se asigna al sitio primario cuando el texto lo permite; el órgano de la metástasis no define la categoría.

El desglose considera solo la marca Sanaré y respeta los filtros de fecha y sede del dashboard. Las afecciones no oncológicas se muestran por su nombre o grupo concreto (por ejemplo, «Anemia / Ferropenia» y «Osteoporosis / Osteopenia»), sin una fila «Otros Diagnósticos». El diagnóstico original de cada registro no se altera.

Se revisaron los 44 registros que antes aparecían como «Otros Diagnósticos» en la exportación del 12 de noviembre de 2026. Condrosarcoma se asigna a sarcomas; los tumores germinales retroperitoneales, la enfermedad trofoblástica gestacional y las neoplasias neuroendocrinas reciben categorías específicas. Las enfermedades no oncológicas también quedan en grupos con nombre. Esta revisión no supone que toda enfermedad trofoblástica o todo teratoma inmaduro sea maligno; la categoría refleja el diagnóstico escrito, no una confirmación histológica adicional.

## Fuentes consultadas

- [Instituto Nacional del Cáncer: cáncer por ubicación en el cuerpo](https://www.cancer.gov/espanol/tipos/por-partes-cuerpo).
- [Instituto Nacional del Cáncer: lista de tipos de cáncer](https://www.cancer.gov/espanol/tipos).
- [Instituto Nacional del Cáncer: cáncer metastásico y sitio primario](https://www.cancer.gov/espanol/tipos/cancer-metastatico).
- [SEER: agrupación de sitios CIE-O-3](https://seer.cancer.gov/siterecode/icdo3_2023_expanded/).
- [Instituto Nacional del Cáncer: condrosarcoma](https://www.cancer.gov/espanol/tipos/hueso/hoja-informativa-hueso).
- [Instituto Nacional del Cáncer: tumores germinales extragonadales](https://www.cancer.gov/espanol/tipos/extragonadal-celulas-germinativas/paciente/tratamiento-extragonadal-pdq).
- [Instituto Nacional del Cáncer: enfermedad trofoblástica gestacional](https://www.cancer.gov/espanol/publicaciones/diccionarios/diccionario-cancer/def/tumor-trofoblastico-de-la-gestacion).

Las etiquetas finales siguen la tabla del usuario cuando esta separa sitios que podrían combinarse de otras maneras (por ejemplo, colon y recto). Se completaron los sitios ausentes para que los diagnósticos oncológicos aparezcan en la tabla agrupada.
