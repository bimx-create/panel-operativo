// Categorías que sustituyen los diagnósticos individuales en el desglose
// interactivo. Los textos originales de los registros no se modifican.
function esDiagnosticoOncologico(diagnostico) {
  const texto = normalizarTexto(diagnostico);
  return /\b(cancer|leucemia|linfoma|mieloma|melanoma|sarcoma|carcinoma|adenocarcinoma|colangiocarcinoma|glioblastoma|mesotelioma|hepatocarcinoma|osteosarcoma|gist)\b|\b(neoplasia|tumor) malign[ao]\b|^ca\b/.test(texto);
}

// Categorías de reporte basadas en sitio primario. La referencia mantiene
// separados colon/recto, ovario/otros ginecológicos y riñón/vías urinarias.
// Los grupos amplios son deliberados: no sustituyen el diagnóstico clínico.
const CATEGORIAS_CANCER = [
  { nombre: "Cáncer / Neoplasia de Mama", patron: /\b(mama|mamari[ao]|seno|senos)\b/ },
  { nombre: "Cáncer / Neoplasia de Recto / Colorrectal", patron: /\b(recto|rectal|colorrectal|colorectal)\b/ },
  { nombre: "Cáncer / Neoplasia de Colón", patron: /\b(colon|colonico|colonica)\b/ },
  { nombre: "Cáncer / Neoplasia de Pulmón", patron: /\b(pulmon|pulmonar|bronquio|bronquial|traqueobronquial)\b/ },
  { nombre: "Cáncer / Neoplasia de Páncreas", patron: /\b(pancreas|pancreatic[ao])\b/ },
  { nombre: "Cáncer / Neoplasia de Ovario", patron: /\b(ovario|ovaric[ao])\b/ },
  { nombre: "Sarcomas / Tejidos Blandos / Óseo", patron: /\b(sarcoma|osteosarcoma|rabdomiosarcoma|ewing|tejidos? blandos?|oseo|osea|hueso)\b/ },
  { nombre: "Colangiocarcinoma / Vías Biliares / Vesícula", patron: /\b(colangiocarcinoma|vias? biliares?|conductos? biliares?|vesicula biliar)\b/ },
  { nombre: "Cáncer / Neoplasia de Tiroides", patron: /\b(tiroides|tiroide[ao])\b/ },
  { nombre: "Cáncer / Neoplasia Gástrica / Esófago", patron: /\b(gastric[ao]|estomago|esofago|esofagic[ao])\b/ },
  { nombre: "Cáncer Ginecológico (Endometrio / Cérvix / Vagina / Vulva)", patron: /\b(cervicouterino|cervical|cervix|cuello uterino|utero|uterin[ao]|endometrio|endometrial|vagina|vaginal|vulva|trompa de falopio|trompas de falopio)\b/ },
  { nombre: "Cáncer Genitourinario Masculino (Próstata / Pene / Testículo)", patron: /\b(prostata|prostatic[ao]|pene|penian[ao]|testiculo|testicular)\b/ },
  { nombre: "Sistema Nervioso Central / Cerebro", patron: /\b(cerebro|cerebral|encefalo|sistema nervioso central|medula espinal|glioblastoma|astrocitoma|meduloblastoma)\b/ },
  { nombre: "Cáncer / Neoplasia Renal", patron: /\b(renal|rinon|rinones|nefroblastoma|tumor de wilms)\b/ },
  { nombre: "Cáncer de Cabeza y Cuello", patron: /\b(cabeza y cuello|orofaringe|nasofaringe|hipofaringe|faringe|laringe|lengua|boca|cavidad oral|labio|glandulas? salivales?|seno paranasal|cavidad nasal)\b/ },
  { nombre: "Cáncer de Vías Urinarias / Vejiga / Urotelio", patron: /\b(vejiga|vesical|vias? urinarias?|urotelio|urotelial|ureter|uretra|pelvis renal)\b/ },
  { nombre: "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)", patron: /\b(leucemia|linfoma|mieloma|hodgkin)\b/ },
  { nombre: "Cáncer de Piel / Melanoma", patron: /\b(melanoma|piel|cutane[ao]|basocelular|celulas de merkel)\b/ },
  { nombre: "Cáncer de Hígado", patron: /\b(higado|hepatic[ao]|hepatocarcinoma|hepatocelular)\b/ },
  { nombre: "Cáncer Digestivo (Intestino Delgado / Ano / Apéndice)", patron: /\b(intestino delgado|duodeno|yeyuno|ileon|ano|anal|apendice|peritoneo)\b/ },
  { nombre: "Cáncer de Tórax / Pleura / Mediastino", patron: /\b(pleura|pleural|mesotelioma|mediastino|timo|timoma)\b/ },
  { nombre: "Cáncer Endocrino / Suprarrenal", patron: /\b(suprarrenal|adrenal|paratiroides|hipofisis|feocromocitoma)\b/ },
  { nombre: "Cáncer de Ojo", patron: /\b(ojo|ocular|retina|retinoblastoma|uveal)\b/ }
];

function categoriaCancer(diagnostico) {
  const homologado = homologarDiagnostico(diagnostico);
  const texto = normalizarTexto(diagnostico);
  if (/\bcondrosarcoma\b/.test(texto)) return "Sarcomas / Tejidos Blandos / Óseo";
  if (/\benfermedad trofoblastica gestacional\b/.test(texto)) return "Enfermedad Trofoblástica Gestacional";
  if (/\b(tumor germinal|teratoma inmaduro)\b/.test(texto) && /\b(retroperitoneal|retroperitonial)\b/.test(texto)) return "Tumor Germinal Extragonadal / Retroperitoneal";
  if (/\b(tumor|carcinoma) neuroendocrino\b/.test(texto)) return "Neoplasia Neuroendocrina (Sitio no Indicado)";
  if (!esDiagnosticoOncologico(texto) && !esDiagnosticoOncologico(homologado)) return "";
  // Las metástasis no cambian el sitio del tumor primario. Ante una frase
  // explícita de diseminación, se ignora el destino después de esa frase.
  const primario = texto
    .replace(/\b(?:con )?(?:metastasis|metastasico|metastasica|metastico|metastica|mts)\b.*$/, "")
    .replace(/\bcon (?:actividad tumoral|at pulmonar)\b.*$/, "")
    .replace(/\brecurrente a\b.*$/, "").trim() || texto;
  if (/\bcolon\b/.test(primario) && /\brecto\b/.test(primario)) return "Cáncer / Neoplasia de Recto / Colorrectal";
  if (/\bcolon\b/.test(primario) && /\bapendice\b/.test(primario)) return "Cáncer / Neoplasia de Colón";
  // Algunas familias tienen prioridad sobre el órgano mencionado, como en
  // "sarcoma de útero", "linfoma cutáneo" y "melanoma ocular".
  if (/\b(sarcoma|osteosarcoma|rabdomiosarcoma|ewing)\b/.test(primario)) return "Sarcomas / Tejidos Blandos / Óseo";
  if (/\b(leucemia|linfoma|mieloma|hodgkin)\b/.test(primario)) return "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)";
  if (/\bcancer hematologico\b/.test(primario)) return "Cáncer Hematológico (Leucemia / Linfoma / Mieloma)";
  if (/\bmelanoma\b/.test(primario) && /\b(ocular|ojo|uveal|retina)\b/.test(primario)) return "Cáncer de Ojo";
  if (/\bseno paranasal\b/.test(primario)) return "Cáncer de Cabeza y Cuello";
  if (/\b(colangiocarcinoma|vias? biliares?|conductos? biliares?)\b/.test(primario)) return "Colangiocarcinoma / Vías Biliares / Vesícula";
  if (/\bpelvis renal\b/.test(primario)) return "Cáncer de Vías Urinarias / Vejiga / Urotelio";
  const encontrados = CATEGORIAS_CANCER.filter(({ patron }) => patron.test(primario));
  if (encontrados.length === 1) return encontrados[0].nombre;
  if (encontrados.length > 1) return apartadoValorCelda(diagnostico);
  if (/\badenocarcinoma\b/.test(primario)) return "Adenocarcinoma (Sitio no Indicado)";
  return apartadoValorCelda(diagnostico);
}

function categoriaDiagnostico(diagnostico) {
  const cancer = categoriaCancer(diagnostico);
  if (cancer) return cancer;
  const texto = normalizarTexto(diagnostico);
  if (!texto) return "Sin Dato";
  if (/\b(osteoporosis|osteopenia)\b/.test(texto) && /\b(anemia|ferropenia)\b/.test(texto)) return "Anemia y Osteoporosis";
  if (/\b(osteoporosis|osteopenia)\b/.test(texto)) return "Osteoporosis / Osteopenia";
  if (/\b(anemia|ferropenia)\b/.test(texto)) return "Anemia / Ferropenia";
  if (/\b(alzheimer|demencia)\b/.test(texto)) return "Demencia / Alzheimer";
  if (/\b(neuritis\s*optica|neuritisoptica|neutris optica|neuromielitis optica)\b/.test(texto)) return "Neuritis / Neuromielitis Óptica";
  if (/\bartritis reumatoide\b/.test(texto)) return "Artritis Reumatoide";
  if (/\benfermedad pulmonar intersticial\b/.test(texto)) return "Enfermedad Pulmonar Intersticial";
  if (/\btelangiectasia hemorragica hereditaria\b/.test(texto)) return "Telangiectasia Hemorrágica Hereditaria";
  return apartadoValorCelda(diagnostico);
}
