# Dietamigo

Aplicação destinada para a disciplina Projeto de Desenvolvimento Tecnológico para o Mundo II - 2025.1

## Prerequisitos

- NodeJS 

## Instruções de build

```bash
$ git clone https://github.com/GabrielLarena/MUNDO2
$ cd MUNDO2
$ npm install
$ npm start
```

## Coisas...

1. TACO (Tabela Brasileira de Composição de Alimentos) – Unicamp
Tipo: Gratuito, oficial

Dados: Nutrientes de alimentos comuns no Brasil (arroz, feijão, carnes, frutas, etc.)

Link: http://www.nepa.unicamp.br/taco/

Formato: Planilha ou PDF

Prós: Dados confiáveis e específicos da realidade brasileira
Contras: Não tem API; precisa importar manualmente para seu banco de dados

2. IBGE – Pesquisa de Orçamentos Familiares (POF)
Tipo: Gratuito

Dados: Lista extensa de alimentos consumidos no Brasil com dados nutricionais

Link: https://www.ibge.gov.br/

Prós: Boa base para entender hábitos alimentares no Brasil
Contras: Mais estatístico; exige tratamento e cruzamento com outras tabelas

3. Open Food Facts (versão PT-BR)
Tipo: Colaborativo, gratuito

Dados: Produtos alimentícios industrializados com rótulo nutricional

Link: https://br.openfoodfacts.org/

Prós: Muitos produtos do mercado brasileiro; tem API
Contras: Dados podem ter erros ou faltar detalhes
