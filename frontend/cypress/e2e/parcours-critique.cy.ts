describe('Parcours critique DataShare (e2e)', () => {
  const email = `e2e-${Date.now()}@test.datashare.local`;
  const password = 'MotDePasse123!';
  const fileName = 'rapport-e2e.txt';
  const fileContent = 'Contenu du fichier envoyé par le test e2e Cypress.';

  it("crée un compte, téléverse un fichier et le télécharge depuis le lien public", () => {
    // --- Inscription ---
    cy.visit('/auth');
    cy.contains('button', 'Créer un compte').click();
    cy.get('input[type=email]').type(email);
    cy.get('input[type=password]').eq(0).type(password);
    cy.get('input[type=password]').eq(1).type(password); // vérification du mot de passe
    cy.contains('button', 'Créer mon compte').click();

    // --- Redirigé, authentifié, sur l'écran de téléversement ---
    cy.location('pathname').should('eq', '/');
    cy.contains('Tu veux partager un fichier ?');

    // --- Téléversement ---
    cy.get('input[type=file]').selectFile(
      {
        contents: Cypress.Buffer.from(fileContent),
        fileName,
        mimeType: 'text/plain',
      },
      { force: true }, // l'input est visuellement masqué (habillé en bouton)
    );
    cy.contains('button', 'Téléverser').click();

    // --- Succès : récupère le lien public affiché ---
    cy.contains('Félicitations');
    cy.get('.link-box a')
      .invoke('attr', 'href')
      .should('be.a', 'string')
      .as('downloadUrl');

    // --- Suivi du lien public (déconnecté de la session, comme un vrai destinataire) ---
    cy.get<string>('@downloadUrl').then((href) => cy.visit(href));
    cy.contains(fileName);
    cy.contains('button', 'Télécharger').click();

    // --- Le fichier téléchargé a bien le contenu envoyé ---
    const downloadsFolder = Cypress.config('downloadsFolder');
    cy.readFile(`${downloadsFolder}/${fileName}`).should('eq', fileContent);
  });
});
