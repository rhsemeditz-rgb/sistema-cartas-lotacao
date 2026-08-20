const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, HeightRule, BorderStyle, PageOrientation
} = require('docx');
const fs = require('fs');
const path = require('path');

const brasaoBuffer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'brasao-doc.png'));

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function dataExtenso(d = new Date()) {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Cria um run de texto normal ou em negrito
const T = (text, bold = false) => new TextRun({ text, bold, font: 'Arial', size: 22 });

// Parágrafo em branco
const linhaVazia = () => new Paragraph({ children: [new TextRun('')] });

function gerarCartaDocx(dados) {
  const {
    diretor_nome, escola_nome, escola_endereco,
    servidor_nome, servidor_cpf, servidor_rg,
    servidor_matricula, servidor_telefone,
    cargo, carga_horaria, ano_serie, turno,
    observacao
  } = dados;

  const dataStr = `Imperatriz, MA, ${dataExtenso()}.`;

  const doc = new Document({
    creator: 'SEMED Imperatriz',
    title: 'Carta de Apresentação',
    description: 'Carta de lotação de servidor',
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1200, bottom: 1000, left: 1200 }
        }
      },
      children: [

        // Cabeçalho - Brasão centralizado
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: brasaoBuffer,
              transformation: { width: 70, height: 75 },
              type: 'png'
            })
          ]
        }),

        // Cabeçalho institucional
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
          children: [new TextRun({ text: 'ESTADO DO MARANHÃO', bold: true, font: 'Arial', size: 22 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'PREFEITURA MUNICIPAL DE IMPERATRIZ', bold: true, font: 'Arial', size: 22 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'SECRETARIA MUNICIPAL DE EDUCAÇÃO', bold: true, font: 'Arial', size: 22 })]
        }),

        linhaVazia(),

        // Título
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 300 },
          children: [new TextRun({ text: 'CARTA DE APRESENTAÇÃO', bold: true, font: 'Arial', size: 26 })]
        }),

        // Prezado / Escola / Endereço
        new Paragraph({
          spacing: { after: 100 },
          children: [T('PREZADO(A): ', true), T(diretor_nome, true)]
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [T('ESCOLA/CRECHE: ', true), T(escola_nome, true)]
        }),
        new Paragraph({
          spacing: { after: 300 },
          children: [T('ENDEREÇO: ', true), T(escola_endereco, true)]
        }),

        // Parágrafo 1
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
          children: [
            T('A partir desta data, o(a) Servidor(a) '),
            T(servidor_nome, true),
            T(', CPF: '),
            T(servidor_cpf, true),
            T(', RG: '),
            T(servidor_rg, true),
            T(', matrícula '),
            T(servidor_matricula, true),
            T(', telefone: '),
            T(servidor_telefone, true),
            T(', passa a compor o quadro de pessoal deste estabelecimento de ensino.')
          ]
        }),

        // Parágrafo 2
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
          children: [
            T('O(A) mesmo(a) ocupará o cargo de '),
            T(cargo, true),
            T(', com carga horária de '),
            T(`${carga_horaria} horas`, true),
            T(' semanais, no(s) '),
            T(ano_serie, true),
            T(', turno(s) '),
            T(turno, true),
            T(', e não poderá ser removido(a) sem autorização desta Coordenação.')
          ]
        }),

        // Parágrafo 3
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
          children: [
            T('O(A) Servidor(a) terá de se apresentar na escola/creche no prazo de UM DIA ÚTIL a partir do recebimento desta Carta de Apresentação.')
          ]
        }),

        // Observação (se preenchida)
        ...(observacao && observacao.trim() ? [
          linhaVazia(),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200, line: 360 },
            children: [T(observacao.trim(), true)]
          })
        ] : []),

        linhaVazia(),
        linhaVazia(),

        // Data
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
          children: [T(dataStr, true)]
        }),

        linhaVazia(),
        linhaVazia(),
        linhaVazia(),

        // Assinaturas - linha 1
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [T('_______________________________          _______________________________')]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [T('Assinatura do(a) responsável pela lotação        Assinatura do(a) Servidor(a)')]
        }),

        linhaVazia(),

        // Assinaturas - linha 2
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [T('_______________________________          _______________________________')]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [T('Assinatura do(a) Diretor(a)                       Data de apresentação na escola')]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [T('Carimbo da Escola                                    ______/______/' + new Date().getFullYear())]
        }),

        linhaVazia(),
        linhaVazia(),

        // Observação final
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Obs.: uma via desta carta deverá ser devolvida à SEMED', font: 'Arial', size: 20, italics: true })]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Para controle do Setor Pessoal.', font: 'Arial', size: 20, italics: true })]
        })
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { gerarCartaDocx };
