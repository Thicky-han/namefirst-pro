# NameFirst Pro

![Proposta de ícone Pro](./assets/brand/icon-128.png)

**O nome primeiro; evidências no momento da busca.** Extensão independente AGPL-3.0-only para Chrome/Edge no computador e Bing/Baidu, sem fork. `1.0.0-rc.1` é um candidato local aguardando aprovação do ícone e publicação. Ainda não existe download público. A interface usa chinês simplificado; nove READMEs traduzidos não significam nove idiomas de interface.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

## Instalação e uso

1. Em `release/1.0.0-rc.1/`, escolha o ZIP terminado em `chrome.zip` ou `edge.zip`. Extraia tudo para uma pasta permanente. `source.zip` contém o código correspondente, não a extensão para carregar.
2. Abra `chrome://extensions` ou `edge://extensions`, ative o modo de desenvolvedor e carregue a pasta extraída que contém diretamente `manifest.json`.
3. Na janela da extensão, ative o controle geral e o mecanismo desejado. Se quiser, escolha “开启联网核验权限” e leia o pedido do navegador. Sem permissão não há leitura de evidências externas; o acesso pode ser revogado.
4. Pesquise, por exemplo, `Apache Arrow official website` na busca web normal. O cartão mostra estado, endereço exato, fontes e horário. Os resultados originais permanecem, sem redirecionamento automático.
5. Corrija buscas informativas com “这次查资料”. Apenas rótulos explícitos treinam; ignorar ou não clicar não treina. URLs, apelidos e rejeições pessoais não certificam identidade oficial.
6. Exporte JSON na gestão. Em outro navegador selecione o arquivo, visualize mesclagem/substituição e confirme. Conflitos preservam dados locais; formatos desconhecidos não sobrescrevem. Permissões, preferências, cache e desfazer não são migrados.
7. Faça backup antes de atualizar, substitua todos os arquivos extraídos, recarregue a extensão e atualize as abas. Não desinstale primeiro: os dados locais serão apagados.

Veja [instalação detalhada em inglês](./INSTALL.en.md), [gestão](./MANAGEMENT.md) e [privacidade](./PRIVACY.md). Há edição, exclusão, desfazer da última mudança e proteção de rascunhos simultâneos.

## Escopo e limites

O nome não precisa estar em um catálogo instalado. A única política positiva de autoridade atual cobre entradas de início/download explicitamente indicadas no diretório de projetos Apache. Wikidata fornece pistas. Posição, HTTPS, declaração do próprio site, pontuação do modelo ou escolha pessoal não bastam para certificar. Não há política genérica para documentação/login nem garantia universal de sites, segurança ou credenciamento.

Somente layouts reconhecidos do Bing HTTPS `/search` e de `www.baidu.com/s` UTF-8 no computador. CAPTCHA, login, layout oculto/desconhecido, limites e tempo esgotado interrompem a tarefa ou deixam sem conclusão, sem contornar barreiras. A pedido do usuário, a aceitação normal on-line não é condição desta etapa. Aprendizado/perguntas podem ser desligados. Não se guarda o histórico completo; evidências antigas são cache e uma falha não renova o horário.

[Avaliação](./EVALUATION.md): 36 consultas escritas manualmente com nomes reais, modelo treinado com 25 acertos, 6 abstenções e 5 buscas informativas ativadas incorretamente. Em 24 cenários sintéticos, 23 resultados esperados; nenhuma das 3 certificações foi falsa. Um caso de documentação recusou com segurança, sem atingir a meta. Não é amostra de tráfego real nem estimativa de toda a web.

## Desenvolvimento e licença

Node.js 24+ / pnpm 11.25.0: `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`. Empacotar exige também Git/Python 3.9+, `pnpm release:prepare` e `pnpm release:verify`. Usuários dos ZIPs não precisam de conta, API Key ou ferramentas. Confira os arquivos com `SHA256SUMS`.

Código original e a arte Pro derivada autorizada nesta etapa: AGPL-3.0-only; dependências mantêm suas licenças. Não se copia código, catálogo, identidade da extensão ou histórico Git do antecessor. [Origem da marca](./assets/brand/README.md) · [Notas](./RELEASE_NOTES.md) · [LICENSE](./LICENSE).
