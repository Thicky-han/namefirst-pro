# NameFirst Pro

![Icône Pro bleue](./assets/brand/icon-128.png)

**Le nom d’abord, les preuves au moment de la recherche.** NameFirst Pro est une extension indépendante et libre pour Chrome/Edge sur ordinateur. Elle détermine si une recherche Bing/Baidu vise une entrée officielle, découvre des candidats même pour un nom absent de tout catalogue installé et, avec votre autorisation, examine des preuves publiques actuelles. Sa licence **AGPL-3.0-only** autorise l’utilisation commerciale sous ses conditions.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

**Première version : `1.0.0`, avec une identité bleue approuvée.** Utilisez les [Releases officielles](https://github.com/Thicky-han/namefirst-pro/releases). Si `v1.0.0` n’y figure pas encore, la publication attend la confirmation finale du responsable et les paquets ne sont pas publics. Le ZIP des sources ne s’installe pas directement. **L’interface reste en chinois simplifié** : neuf README traduits ne signifient pas neuf langues d’interface.

## Fonctionnalités

- Pour chaque recherche prise en charge, inférence locale de l’intention : trouver une entrée, s’informer ou incertitude. Aucun enregistrement préalable du nom n’est requis.
- Pour une intention de navigation, collecte limitée de candidats et de preuves actuelles ; affichage de l’adresse exacte, de l’usage, des sources, de l’heure et de l’état. Si les preuves manquent, l’extension peut s’abstenir.
- Conservation des résultats originaux, sans redirection, téléchargement ni exécution automatiques.
- Apprentissage local uniquement à partir de retours explicites. Les URL, alias et exclusions personnels sont distincts d’une attribution officielle.
- Modification, suppression, annulation du dernier changement et sauvegardes JSON avec prévisualisation avant fusion/remplacement ; transfert manuel entre Chrome et Edge.

## Télécharger et installer

Un utilisateur du ZIP prêt à charger n’a besoin ni de Node.js, ni de compte, de clé API, de serveur du projet ou de compilation.

1. Dans les [Releases](https://github.com/Thicky-han/namefirst-pro/releases), ouvrir la version officielle `v1.0.0`. Choisir `namefirst-pro-1.0.0-chrome.zip` pour Chrome ou `namefirst-pro-1.0.0-edge.zip` pour Edge. `namefirst-pro-1.0.0-source.zip` contient les sources correspondantes.
2. Extraire **tous les fichiers** dans un dossier permanent. Ne pas charger depuis le ZIP et ne pas supprimer ce dossier après installation.
3. Ouvrir `chrome://extensions` ou `edge://extensions`, activer le mode développeur et choisir le chargement d’une extension non empaquetée.
4. Sélectionner le dossier qui **contient directement `manifest.json`**, pas son dossier parent. Vérifier que **NameFirst Pro** est chargé ; épingler éventuellement l’icône NF/PRO bleue dans la barre d’outils.
5. Ouvrir la fenêtre de l’extension et activer les interrupteurs général/moteur souhaité. Pour lire des preuves externes, sélectionner « 开启联网核验权限 », lire la demande d’accès aux sites HTTPS du navigateur puis l’autoriser. L’accès est révocable ; sans accord, aucune preuve externe n’est lue.
6. Sur une recherche web classique Bing/Baidu sur ordinateur, essayer `Apache Arrow official website`. Lire **l’état actuel, l’entrée exacte, les sources et l’heure** de la carte. Seules les preuves de cette tâche satisfaisant la politique peuvent soutenir l’attribution officielle. Un nom inconnu entre aussi dans la découverte, sans garantie de certification.

Voir le [guide détaillé en anglais](./INSTALL.en.md) ou [en chinois simplifié](./INSTALL.md).

## Retours, sauvegarde et mise à jour

Si une recherche documentaire déclenche une navigation, choisir « 这次查资料 ». « 我在找入口 » indique que vous cherchez une entrée. « 仅本次按入口核验 » ne confirme que cette tâche, sans enregistrer d’étiquette d’apprentissage. Ignorer ou ne pas cliquer n’entraîne pas le modèle. Apprentissage et questions peuvent être désactivés séparément. Les adresses personnelles restent clairement non certifiées.

Ouvrir la gestion avec « 管理记录、查看历史证据与备份迁移 », puis « 导出 JSON 备份 ». Dans un nouveau navigateur, sélectionner le fichier et fusion/remplacement, utiliser « 预览导入 », examiner les enregistrements et conflits, puis confirmer. La fusion conserve les données locales en conflit ; le remplacement écrase les données personnelles et d’apprentissage. Autorisations, préférences, preuves historiques et annulation sont exclues : les régler séparément. Les formats inconnus ou corrompus n’écrasent pas l’existant. Les sauvegardes contiennent les noms/URL saisis volontairement : les conserver en privé.

Avant une mise à jour, sauvegarder, extraire tous les nouveaux fichiers et remplacer ceux du dossier chargé. Recharger l’extension dans sa page de gestion, puis actualiser les onglets de recherche. Remplacer les fichiers sur disque ne suffit pas toujours à arrêter l’ancien service d’arrière-plan. **Ne pas désinstaller d’abord** : cela efface les données locales. Garder la même identité d’extension et le même profil les préserve normalement, sans garantie pour tous les futurs formats.

Sans carte, vérifier l’URL/la disposition prise en charge, les interrupteurs et l’actualisation de l’onglet après mise à jour. Si la vérification échoue, vérifier l’autorisation externe, le réseau et la raison affichée. CAPTCHA, connexion, limites et délais dépassés provoquent arrêt ou abstention, sans contournement. Il est aussi possible de suspendre un moteur ou de révoquer l’autorisation. [Gestion détaillée](./MANAGEMENT.md).

## Portée et confidentialité

La seule politique d’autorité permettant actuellement une attribution positive couvre les **entrées accueil/téléchargement** explicitement indiquées dans l’annuaire de projets maintenu par Apache. Wikidata fournit des pistes uniquement. Classement, HTTPS, auto-déclaration, score du modèle et préférence personnelle ne suffisent pas à certifier. Pas de politique générale pour documentation/connexion, ni de garantie concernant tout le Web, la sécurité des logiciels ou des qualifications juridiques.

Seules les dispositions reconnues de Bing HTTPS `/search` (`www.bing.com`, `cn.bing.com`, `bing.com`) et de `www.baidu.com/s` en UTF-8 sont prises en charge pour la recherche web de bureau. Mobile, images/actualités et dispositions cachées/inconnues sont hors périmètre. À la demande du responsable, la recette habituelle en ligne réelle n’est pas une condition de cette étape ; tests contrôlés de navigateur et observations historiques en ligne sont rapportés séparément.

Ni télémétrie, ni entraînement distant, ni envoi automatique de retours, ni conservation de l’historique complet des recherches. Les étiquettes explicites et enregistrements personnels restent locaux. Après autorisation, les sites consultés peuvent voir l’IP et l’URL demandée ; la découverte complémentaire peut envoyer le nom concerné au moteur de recherche. Ce n’est donc ni entièrement hors ligne ni anonyme. Les preuves anciennes restent du cache ; un échec ne renouvelle pas leur date. Chaque tâche de navigation collecte des preuves actuelles. [Confidentialité](./PRIVACY.md) · [Apprentissage](./LEARNING.md).

[Évaluation publique](./EVALUATION.md) : sur 36 requêtes rédigées manuellement avec de vrais noms de logiciels, le modèle déjà entraîné classe correctement 25 requêtes, s’abstient sur 6 et déclenche à tort une navigation sur 5 recherches documentaires. Sur 24 cas de confiance synthétiques, 23 correspondent à l’état attendu ; aucune des 3 certifications n’est fausse. Un cas documentaire s’abstient par prudence mais manque l’objectif fonctionnel. Ces résultats n’estiment ni le trafic réel ni la précision de tout le Web.

## Développement et licence

Node.js 24+ et pnpm 11.25.0 :

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

L’empaquetage utilise aussi Git, Python 3.9+, `pnpm release:prepare` et `pnpm release:verify`. Comparer les archives avec `SHA256SUMS` et `Get-FileHash -Algorithm SHA256 <nom-du-fichier>`. Une somme identique ne garantit pas la sécurité.

Implémentation et historique Git indépendants. L’icône Pro bleue, dérivée autorisée du motif NF/flèche original, est approuvée. Le code original et ce dérivé graphique sont sous AGPL-3.0-only ; les dépendances gardent leurs licences. [Provenance graphique](./assets/brand/README.md) · [Dépendances](./DEPENDENCIES.md) · [LICENSE](./LICENSE) · [Notes de version](./RELEASE_NOTES.md) · [Contribuer](./CONTRIBUTING.md).
