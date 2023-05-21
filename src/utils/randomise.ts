// Fisher-Yates Shuffle
export function shuffleArray(array: any[]) {
  let currentIndex = array.length
  let randomIndex

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    ;[array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ]
  }
}

export const fullCardDeck = [
  '01K',
  '02K',
  '03K',
  '04K',
  '05K',
  '06K',
  '07K',
  '08K',
  '09K',
  '10K',
  '11K',
  '12K',
  '13K',
  '01O',
  '02O',
  '03O',
  '04O',
  '05O',
  '06O',
  '07O',
  '08O',
  '09O',
  '10O',
  '11O',
  '12O',
  '13O',
  '01P',
  '02P',
  '03P',
  '04P',
  '05P',
  '06P',
  '07P',
  '08P',
  '09P',
  '10P',
  '11P',
  '12P',
  '13P',
  '01T',
  '02T',
  '03T',
  '04T',
  '05T',
  '06T',
  '07T',
  '08T',
  '09T',
  '10T',
  '11T',
  '12T',
  '13T',
]

export function convertCardName(cardName: string): string {
  let newName = ''
  if (cardName[0] === '1') {
    switch (cardName[1]) {
      case '0':
        newName += 'T'
        break
      case '1':
        newName += 'J'
        break
      case '2':
        newName += 'Q'
        break
      case '3':
        newName += 'K'
    }
  } else if (cardName[1] === '1') {
    // Ace
    newName += 'A'
  } else {
    newName += cardName[1]
  }
  switch (cardName[2]) {
    case 'K':
      newName += 'h'
      break
    case 'O':
      newName += 'd'
      break
    case 'T':
      newName += 'c'
      break
    case 'P':
      newName += 's'
  }
  return newName
}
