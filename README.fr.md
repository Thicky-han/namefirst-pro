# NameFirst Pro

![Proposition d’icône Pro](./assets/brand/icon-128.png)

**Le nom d’abord, les preuves au moment de la recherche.** Extension indépendante AGPL-3.0-only pour Chrome/Edge de bureau et les recherches Bing/Baidu ; ce n’est pas un fork. `1.0.0-rc.1` est un candidat local, en attente de validation de l’icône et de publication. Aucun téléchargement public n’est encore disponible. L’interface est en chinois simplifié : neuf README traduits ne constituent pas neuf langues d’interface.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

## Installation et utilisation

1. Dans `release/1.0.0-rc.1/`, choisir le ZIP se terminant par `chrome.zip` ou `edge.zip`. Tout extraire dans un dossier permanent. `source.zip` contient les sources correspondantes et n’est pas le paquet à charger.
2. Ouvrir `chrome://extensions` ou `edge://extensions`, activer le mode développeur et charger le dossier décompressé contenant directement `manifest.json`.
3. Ouvrir la fenêtre de l’extension et activer les interrupteurs général/moteur. Si souhaité, sélectionner « 开启联网核验权限 » et lire la demande du navigateur. Sans accord, aucune preuve externe n’est lue. L’accès est révocable.
4. Rechercher, par exemple, `Apache Arrow official website` sur une page web classique. Consulter l’état, l’adresse exacte, les sources et l’heure dans la carte indépendante. Les résultats originaux restent ; aucune redirection automatique.
5. Corriger une recherche documentaire avec « 这次查资料 ». Seuls les retours explicites entraînent le modèle ; ignorer ou ne pas cliquer ne l’entraîne pas. Les adresses personnelles restent non certifiées.
6. Exporter un JSON depuis la gestion. Dans un nouveau navigateur, sélectionner le fichier, prévisualiser fusion/remplacement puis confirmer. Les conflits conservent les données locales ; un format inconnu ne les écrase pas. Autorisations, préférences, cache et annulation ne migrent pas.
7. Sauvegarder avant mise à jour, remplacer les fichiers extraits, recharger l’extension puis les onglets de recherche. Ne pas désinstaller d’abord : cela supprime les données locales.

Voir [l’installation détaillée en anglais](./INSTALL.en.md), [la gestion](./MANAGEMENT.md) et [la confidentialité](./PRIVACY.md). Modification, suppression, annulation d’une étape et protection des brouillons concurrents sont disponibles.

## Portée et limites

Un nom n’a pas besoin d’être dans un catalogue préinstallé. La seule politique d’autorité positive actuelle couvre les entrées accueil/téléchargement explicitement indiquées par l’annuaire Apache. Wikidata fournit des pistes. Classement, HTTPS, auto-déclaration, score du modèle et choix personnel ne suffisent pas à certifier. Pas de politique générale pour documentation/connexion, ni garantie pour tous les sites, la sécurité ou les qualifications.

Seuls les résultats classiques reconnus de Bing HTTPS `/search` et `www.baidu.com/s` en UTF-8 sont pris en charge sur ordinateur. CAPTCHA, connexion, disposition cachée/inconnue, limitation et délai dépassé entraînent arrêt ou abstention, sans contournement. À la demande de l’utilisateur, la recette en ligne normale n’est plus une condition de cette étape. Apprentissage et questions sont désactivables. Aucun historique complet n’est conservé ; une preuve ancienne est toujours un cache et un échec ne renouvelle pas son horodatage.

[Évaluation](./EVALUATION.md) : 36 requêtes rédigées manuellement avec des noms réels, 25 correctes après apprentissage, 6 abstentions et 5 recherches documentaires déclenchées à tort. Sur 24 scénarios de confiance synthétiques, 23 résultats attendus ; aucune des 3 certifications n’est fausse. Un cas documentaire s’abstient sans atteindre l’objectif. Ce n’est pas une estimation du trafic réel ou du Web entier.

## Développement et licence

Node.js 24+ et pnpm 11.25.0 : `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`. L’empaquetage ajoute Git/Python 3.9+, `pnpm release:prepare` et `pnpm release:verify`. L’utilisateur des ZIP n’a besoin ni de compte, ni de clé API, ni de ces outils. Vérifier les archives avec `SHA256SUMS`.

Code original et dérivé graphique Pro autorisé pour cette étape : AGPL-3.0-only ; les dépendances gardent leurs licences. Aucun code, catalogue, identifiant d’extension ou historique Git du prédécesseur n’est repris. [Provenance](./assets/brand/README.md) · [Notes](./RELEASE_NOTES.md) · [LICENSE](./LICENSE).
