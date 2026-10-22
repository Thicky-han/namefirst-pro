# NameFirst Pro

![Ícone Pro azul](./assets/brand/icon-128.png)

**O nome primeiro; evidências no momento da busca.** NameFirst Pro é uma extensão independente de código aberto para Chrome/Edge no computador. Ela identifica se uma busca no Bing/Baidu procura uma entrada oficial, descobre candidatos mesmo para nomes ausentes de um catálogo instalado e, com permissão, examina evidências públicas atuais. A licença **AGPL-3.0-only** permite uso comercial sob suas condições.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

**Primeira versão: `1.0.0`, com identidade visual azul aprovada.** Obtenha os pacotes nas [Releases oficiais](https://github.com/Thicky-han/namefirst-pro/releases). Se `v1.0.0` ainda não aparecer, a publicação continua aguardando a confirmação final do responsável e os pacotes ainda não estão disponíveis. O ZIP de fontes não é instalado diretamente. **A interface está em chinês simplificado**; nove READMEs traduzidos não significam nove idiomas de interface.

## Recursos

- Cada busca compatível recebe uma inferência local: procurar uma entrada, consultar informações ou incerteza. O nome não precisa de cadastro prévio.
- Tarefas de navegação coletam candidatos e evidências atuais dentro de um orçamento limitado. O cartão mostra endereço exato, finalidade, fontes, horário e estado; pode se abster se faltarem evidências.
- Os resultados originais permanecem, sem redirecionamento, download nem execução automática.
- Só feedback explícito treina o modelo local de intenção. URLs, apelidos e exclusões pessoais ficam separados da atribuição oficial.
- Edição, exclusão, desfazer da última mudança e backups JSON com prévia antes de mesclar/substituir; migração manual entre Chrome e Edge.

## Download e instalação

Usuários dos ZIPs prontos não precisam de Node.js, conta, chave de API, servidor do projeto ou compilação.

1. Nas [Releases](https://github.com/Thicky-han/namefirst-pro/releases), abra a versão oficial `v1.0.0`. Para Chrome escolha `namefirst-pro-1.0.0-chrome.zip`; para Edge, `namefirst-pro-1.0.0-edge.zip`. `namefirst-pro-1.0.0-source.zip` contém o código-fonte correspondente.
2. Extraia **todos os arquivos** para uma pasta permanente. Não carregue de dentro do ZIP nem apague essa pasta após instalar.
3. Abra `chrome://extensions` ou `edge://extensions`, ative o modo de desenvolvedor e escolha carregar uma extensão sem compactação.
4. Selecione a pasta que **contém diretamente `manifest.json`**, não a pasta acima dela. Confirme que **NameFirst Pro** foi carregado e, se quiser, fixe o ícone NF/PRO azul na barra.
5. Na janela da extensão, ative os controles geral e do mecanismo desejado. Para consultar evidências externas, escolha “开启联网核验权限”, leia o pedido do navegador para acessar sites HTTPS e autorize. A permissão pode ser revogada; antes da autorização não se leem evidências externas.
6. Na busca web comum do Bing/Baidu no computador, experimente `Apache Arrow official website`. Leia **estado atual, entrada exata, fontes e horário** do cartão. Só evidências desta tarefa que atendam à política apoiam a atribuição oficial. Nomes desconhecidos também entram na descoberta, sem garantia de certificação.

Consulte o [tutorial detalhado em inglês](./INSTALL.en.md) ou [em chinês simplificado](./INSTALL.md).

## Feedback, backup e atualização

Se uma busca informativa disparar navegação, escolha “这次查资料”. “我在找入口” informa que você procura uma entrada. “仅本次按入口核验” confirma somente esta tarefa, sem salvar um rótulo de treinamento. Ignorar ou não clicar não treina. Aprendizado e perguntas podem ser desligados separadamente. Os endereços pessoais continuam claramente não certificados.

Abra a gestão em “管理记录、查看历史证据与备份迁移” e exporte em “导出 JSON 备份”. No novo navegador, selecione arquivo e mesclagem/substituição, use “预览导入”, confira registros e conflitos e confirme. Mesclar preserva registros locais em conflito; substituir sobrescreve dados pessoais e de aprendizado. Permissões, preferências, evidências históricas e desfazer ficam fora e devem ser configurados à parte. Formatos desconhecidos ou corrompidos não sobrescrevem os dados existentes. Backups contêm nomes/URLs inseridos voluntariamente: mantenha-os privados.

Antes de atualizar, faça backup, extraia toda a nova versão e substitua os arquivos carregados. Recarregue a extensão na página de gestão e atualize as abas de busca. Trocar arquivos em disco pode deixar o processo anterior ativo. **Não desinstale primeiro:** isso apaga os dados locais. Manter a identidade da extensão e o perfil normalmente os preserva, sem garantia para todos os formatos futuros.

Sem cartão, confira URL/layout compatível, controles e atualização das abas após mudanças. Se a verificação falhar, confira permissão externa, rede e motivo exibido. CAPTCHA, login, limites e tempo esgotado provocam parada ou abstenção, sem contornar barreiras. Também é possível pausar o mecanismo ou revogar a permissão. [Gestão detalhada](./MANAGEMENT.md).

## Escopo e privacidade

A única política de autoridade que hoje permite atribuição positiva cobre as **entradas de início/download** explicitamente indicadas no diretório de projetos mantido pela Apache. Wikidata só fornece pistas. Posição, HTTPS, declaração do próprio site, pontuação do modelo ou preferência pessoal não bastam para provar identidade oficial. Não há política genérica para documentação/login nem garantia sobre toda a web, segurança de software ou qualificação legal.

Só layouts reconhecidos do Bing HTTPS `/search` (`www.bing.com`, `cn.bing.com`, `bing.com`) e de `www.baidu.com/s` com busca web UTF-8 no computador. Celular, imagens/notícias e layouts ocultos/desconhecidos ficam fora do escopo. A pedido do responsável, a aceitação habitual on-line real não é condição desta etapa; testes controlados no navegador e observações históricas on-line são informados separadamente.

Sem telemetria, treinamento remoto, envio automático de feedback ou armazenamento do histórico completo de buscas. Rótulos explícitos e registros pessoais ficam locais. Após autorizar, sites consultados podem ver IP e URL solicitada; a descoberta adicional pode enviar nomes relacionados ao mecanismo de busca. Portanto não é totalmente off-line nem anônimo na rede. Evidências antigas são sempre cache; falhas na renovação não atualizam sua data. Cada tarefa de navegação reúne evidências atuais. [Privacidade](./PRIVACY.md) · [Aprendizado](./LEARNING.md).

[Avaliação pública](./EVALUATION.md): em 36 consultas escritas manualmente com nomes reais de software, o modelo já treinado acertou 25, absteve-se em 6 e acionou navegação indevidamente em 5 consultas informativas. Em 24 casos sintéticos de confiança, 23 corresponderam ao estado esperado; nenhuma das 3 certificações foi falsa. Um caso de documentação absteve-se com segurança, mas não atingiu a meta funcional. Não são uma amostra de usuários reais nem uma estimativa de precisão para toda a web.

## Desenvolvimento e licença

Node.js 24+ e pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

Empacotar também exige Git, Python 3.9+, `pnpm release:prepare` e `pnpm release:verify`. Compare arquivos com `SHA256SUMS` e `Get-FileHash -Algorithm SHA256 <nome-do-arquivo>`. A correspondência não garante segurança.

Implementação e histórico Git independentes. O ícone Pro azul, derivado autorizado do desenho NF/seta original, foi aprovado. O código original e esse derivado gráfico usam AGPL-3.0-only; dependências mantêm suas licenças. [Origem gráfica](./assets/brand/README.md) · [Dependências](./DEPENDENCIES.md) · [LICENSE](./LICENSE) · [Notas da versão](./RELEASE_NOTES.md) · [Contribuir](./CONTRIBUTING.md).
