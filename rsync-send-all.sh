#!/bin/bash

echo
echo "Envoyer les fichiers de ce répertoire vers le serveur via Rsync/SSH..."
echo

# si des clefs sont utilisées, compléter le fichier ~/.ssh/config
rsync -avz --exclude="opt.openfire" . im.silverpeas.net:/var/www/djoe
