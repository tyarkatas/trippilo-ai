
// Diğer useState tanımlarının yanına ekle:
const [paymentCopied, setPaymentCopied] = useState(false)

// Mevcut copyPaymentAddress fonksiyonunun yerine koy:
async function copyPaymentAddress() {
  const address = paymentInfo?.pay_address

  if (!address) {
    setPaymentError('Kopyalanacak ödeme adresi bulunamadı.')
    return
  }

  setPaymentCopied(false)
  setPaymentError('')

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(address)
    } else {
      // Eski veya kısıtlı tarayıcılar için alternatif yöntem.
      const textArea = document.createElement('textarea')
      textArea.value = address
      textArea.readOnly = true
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()

      const copied = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (!copied) {
        throw new Error('Kopyalama başarısız.')
      }
    }

    setPaymentCopied(true)
  } catch {
    setPaymentError(
      'Otomatik kopyalama başarısız. Ödeme adresini seçip elle kopyalayabilirsin.'
    )
  }
}
