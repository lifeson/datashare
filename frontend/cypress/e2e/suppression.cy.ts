describe('Suppression d’un fichier (e2e)', () => {
  const email = `e2e-delete-${Date.now()}@test.datashare.local`;
  const password = 'MotDePasse123!';
  const fileName = 'a-supprimer.txt';

  it('supprime un fichier depuis « Mes fichiers » et son lien devient invalide', () => {
    // Variable de clôture plutôt qu'un alias Cypress : elle doit survivre au
    // `cy.visit('/mes-fichiers')` ci-dessous, qui recharge entièrement la page.
    let downloadUrl: string | undefined;

    // --- Inscription + téléversement (mise en situation) ---
    cy.visit('/auth');
    cy.contains('button', 'Créer un compte').click();
    cy.get('input[type=email]').type(email);
    cy.get('input[type=password]').eq(0).type(password);
    cy.get('input[type=password]').eq(1).type(password);
    cy.contains('button', 'Créer mon compte').click();

    cy.location('pathname').should('eq', '/');
    cy.get('input[type=file]').selectFile(
      {
        contents: Cypress.Buffer.from('Fichier destiné à être supprimé.'),
        fileName,
        mimeType: 'text/plain',
      },
      { force: true },
    );
    cy.contains('button', 'Téléverser').click();
    cy.contains('Félicitations');
    cy.get('.link-box a')
      .invoke('attr', 'href')
      .then((href) => {
        downloadUrl = href;
      });

    // --- Suppression depuis l'historique ---
    cy.visit('/mes-fichiers');
    cy.contains(fileName)
      .parents('.row')
      .within(() => {
        cy.contains('button', 'Supprimer').click(); // window.confirm : Cypress accepte par défaut
      });
    cy.contains(fileName).should('not.exist');

    // --- Le lien public ne fonctionne plus ---
    cy.then(() => cy.visit(downloadUrl!));
    cy.contains('Lien invalide.');
  });
});
