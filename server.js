const express = require('express');
const cors = require('cors');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione limite per ricevere immagini in Base64 (portato a 20mb)
app.use(express.json({ limit: '20mb' }));
app.use(cors());

// Configurazione Client Brevo API
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY; // Presa dalle Environment Variables di Render

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Rotta POST per ricevere il modulo dal configuratore
app.post('/api/send-visual-request', async (req, res) => {
  const { category, subCategory, specification, diagnosis, address, notes, name, phone, email, image, images } = req.body;

  if (!email || !name || !category) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti.' });
  }

  // Supporto sia per singola foto che per array di foto
  let targetImage = image;
  if (!targetImage && images && Array.isArray(images) && images.length > 0) {
    targetImage = images[0];
  }

  // Prepariamo l'allegato se presente la foto (utilizzando il metodo esatto del codice funzionante)
  let attachments = [];
  if (targetImage) {
    const base64Content = targetImage.includes(';base64,') ? targetImage.split(';base64,').pop() : targetImage;
    attachments.push({
      content: base64Content,
      name: `stato_attuale_${Date.now()}.jpg`
    });
  }

  // 1. EMAIL PER L'UFFICIO TECNICO (con allegato, indirizzo e specifiche)
  const emailToOffice = new SibApiV3Sdk.SendSmtpEmail();
  emailToOffice.subject = `Nuova Richiesta Visual INFIX®: ${category} - ${name}`;
  emailToOffice.sender = { name: "Visual INFIX® Web", email: process.env.SENDER_EMAIL || "info@infix.it" };
  emailToOffice.to = [{ email: process.env.RECIPIENT_EMAIL || "info@infix.it", name: "Ufficio Tecnico INFIX" }];
  
  emailToOffice.htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #004070; border-bottom: 2px solid #4CAF50; padding-bottom: 8px;">
        Nuova Richiesta Preventivo - Visual INFIX®
      </h2>
      <p><strong>Cliente / Azienda:</strong> ${name}</p>
      <p><strong>Telefono / WhatsApp:</strong> ${phone}</p>
      <p><strong>Email Cliente:</strong> ${email}</p>
      <p><strong>Indirizzo Cantiere / Intervento:</strong> ${address || 'Non specificato'}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
      <h3>Dettagli Tecnici Selezionati:</h3>
      <ul>
        <li><strong>Macro Categoria:</strong> ${category}</li>
        <li><strong>Tipologia / Materiale:</strong> ${subCategory}</li>
        <li><strong>Finitura / Colore / Essenza:</strong> ${specification || 'Non specificato'}</li>
        <li><strong>Esigenza / Problema Rilevato:</strong> ${diagnosis}</li>
      </ul>
      <p><strong>Note e Preferenze aggiuntive:</strong></p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #004070;">
        ${notes || 'Nessuna nota inserita.'}
      </blockquote>
      <p><em>La foto dello stato attuale è stata allegata a questa email.</em></p>
    </div>
  `;
  
  // Utilizziamo "attachment" al singolare come nel codice originale funzionante
  if (attachments.length > 0) {
    emailToOffice.attachment = attachments;
  }

  // 2. EMAIL DI RICEVUTA DI CORTESIA PER IL CLIENTE
  const emailToClient = new SibApiV3Sdk.SendSmtpEmail();
  emailToClient.subject = `Abbiamo ricevuto la tua richiesta - INFIX®`;
  emailToClient.sender = { name: "INFIX®", email: process.env.SENDER_EMAIL || "info@infix.it" };
  emailToClient.to = [{ email: email, name: name }];
  
  emailToClient.htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #004070; text-align: center;">Grazie per aver scelto INFIX®!</h2>
      <p>Gentile <strong>${name}</strong>,</p>
      <p>Ti confermiamo di aver ricevuto correttamente la tua richiesta di preventivo tramite il nostro configuratore.</p>
      <p>Il nostro Ufficio Tecnico prenderà in carico le informazioni e l'indirizzo indicati (<strong>${address || 'Non specificato'}</strong>) e ti ricontatterà al più presto al numero <strong>${phone}</strong>.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 13px; color: #666; text-align: center;">Questa è un'email automatica, ti invitiamo a non rispondere direttamente a questo indirizzo.</p>
    </div>
  `;

  try {
    await apiInstance.sendTransacEmail(emailToOffice);
    await apiInstance.sendTransacEmail(emailToClient);

    res.status(200).json({ message: 'Email inviate con successo!' });
  } catch (error) {
    console.error('Errore invio Brevo:', error);
    res.status(500).json({ error: 'Errore nell\'invio dell\'email' });
  }
});

app.listen(PORT, () => {
  console.log(`Server Visual INFIX attivo sulla porta ${PORT}`);
});
