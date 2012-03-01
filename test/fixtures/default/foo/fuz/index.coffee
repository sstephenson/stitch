requireCount = 0

module.exports = {
  count: (-> requireCount )
  bump: (-> requireCount++)
}
