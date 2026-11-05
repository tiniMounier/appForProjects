# 📞 Allô Calme

Une appli toute simple pour les parents : on touche une bulle, et **un personnage « appelle » au téléphone**
pour calmer les enfants surexcités (en voiture, au coucher, à table…).
Un agent IA (Claude) joue le personnage **en direct** : il parle, écoute ce que disent les enfants et s'adapte.

| Bulle | Personnage | Bruitage |
|---|---|---|
| 🚓 | **La Police** : « Allô, bonjour, ici la police. On m'a signalé des enfants qui font des bêtises… » | sirène pin-pon |
| 🐺 | **Le Grand Méchant Loup** : mystérieux, il est attiré par le bruit et ignore les enfants calmes | hurlement |
| 🎅 | **Le Père Noël** : son grand livre des enfants sages | grelots |
| 🐉 | **Le Dragon** : lance des défis (« le plus silencieux devient chevalier du dragon ») | rugissement |
| 🐭 | **La Petite Souris** : jeu du chuchotement, idéal pour les tout-petits | son magique |
| 🌙 | **Le Marchand de Sable** : respiration et petite histoire pour s'endormir | carillon |

## Comment ça marche pendant l'appel

1. Le téléphone sonne, puis le personnage décroche (avec son bruitage).
2. Il parle (synthèse vocale), puis **écoute les enfants** au micro et leur répond.
3. Le parent peut, discrètement :
   - choisir **le problème** avant l'appel (dispute, cris, voiture, coucher, repas, s'habiller, dents, rangement) ;
   - toucher **✅ Ils sont calmes** → le personnage félicite et raccroche ;
   - toucher **🔁 Ça recommence** → le personnage devient un peu plus ferme ;
   - toucher **🔊 Bruitage** pour relancer la sirène, le loup…
4. Dans ⚙️, on peut saisir **les prénoms des enfants** : le personnage les appellera par leur prénom.

Le personnage reste toujours bienveillant : il impressionne un peu, mais ne menace jamais,
et devient tout doux si un enfant a vraiment peur.

## Lancer l'appli

Il faut Node.js 20 ou plus et une clé API Anthropic (https://console.anthropic.com).

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # votre clé
npm start
```

Puis ouvrir http://localhost:3000.

Sur téléphone, le micro du navigateur exige une connexion **HTTPS** : il faut héberger l'appli
(Render, Railway, Fly.io, un VPS…) ou passer par un tunnel (`npx localtunnel --port 3000`, ngrok…).
Ensuite, « Ajouter à l'écran d'accueil » pour qu'elle ressemble à une vraie appli.

Navigateurs conseillés : **Chrome sur Android**, **Safari sur iPhone**.
Sans reconnaissance vocale (ex. Firefox), le personnage parle quand même et continue tout seul.

## Organisation du code

- `server.js` : petit serveur Node (sans dépendance hormis le SDK Anthropic). Sert `public/` et la route
  `POST /api/talk`, qui transmet la réponse de Claude **en continu** (streaming) pour que le personnage
  commence à parler sans attendre la fin de la réponse.
- `characters.js` : les rôles des personnages et les règles communes (ton, bienveillance, balises `[SON]` / `[FIN]`).
- `public/app.js` : l'interface, la boucle « parler → écouter », la lecture phrase par phrase.
- `public/sounds.js` : tous les bruitages, synthétisés avec la Web Audio API (aucun fichier audio).

Pour ajouter un personnage : un bloc dans `characters.js` (son rôle) et une ligne dans `CHARACTERS`
au début de `public/app.js` (emoji, couleur, voix, bruitage).

## Idées pour la suite

- Voix plus réalistes avec un service de synthèse vocale dédié (voix grave pour le loup, etc.).
- Nouveaux personnages : le pompier, la maîtresse, un super-héros, un pirate, un dinosaure.
- Un « rappel » automatique : le personnage rappelle tout seul 10 minutes plus tard pour vérifier.
- Un mode « récompense » : le personnage annonce une étoile ou un autocollant quand c'est réussi.
