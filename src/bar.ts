import {
  ADDRESS_ZERO,
  BIG_DECIMAL_1E18,
  BIG_DECIMAL_1E6,
  BIG_DECIMAL_ZERO,
  BIG_INT_ZERO,
  TRAMS_BAR_ADDRESS,
  TRAMS_TOKEN_ADDRESS,
  TRAMS_USDT_PAIR_ADDRESS,
} from './constants'
import { Address, BigDecimal, BigInt, dataSource, ethereum, log } from '@graphprotocol/graph-ts'
import { Bar, History, User } from '../generated/schema'
import { Bar as BarContract, Transfer as TransferEvent } from '../generated/TramsBar/Bar'

import { Pair as PairContract } from '../generated/TramsBar/Pair'
import { TramsToken as TramsTokenContract } from '../generated/TramsBar/TramsToken'

// TODO: Get averages of multiple trams stablecoin pairs
function getTramsPrice(): BigDecimal {
  const pair = PairContract.bind(TRAMS_USDT_PAIR_ADDRESS)
  const reserves = pair.getReserves()
  return reserves.value1.toBigDecimal().times(BIG_DECIMAL_1E18).div(reserves.value0.toBigDecimal()).div(BIG_DECIMAL_1E6)
}

function createBar(block: ethereum.Block): Bar {
  const contract = BarContract.bind(dataSource.address())
  const bar = new Bar(dataSource.address().toHex())
  bar.decimals = contract.decimals()
  bar.name = contract.name()
  bar.trams = contract.trams()
  bar.symbol = contract.symbol()
  bar.totalSupply = BIG_DECIMAL_ZERO
  bar.tramsStaked = BIG_DECIMAL_ZERO
  bar.tramsStakedUSD = BIG_DECIMAL_ZERO
  bar.tramsHarvested = BIG_DECIMAL_ZERO
  bar.tramsHarvestedUSD = BIG_DECIMAL_ZERO
  bar.xTramsMinted = BIG_DECIMAL_ZERO
  bar.xTramsBurned = BIG_DECIMAL_ZERO
  bar.xTramsAge = BIG_DECIMAL_ZERO
  bar.xTramsAgeDestroyed = BIG_DECIMAL_ZERO
  bar.ratio = BIG_DECIMAL_ZERO
  bar.updatedAt = block.timestamp
  bar.save()

  return bar as Bar
}

function getBar(block: ethereum.Block): Bar {
  let bar = Bar.load(dataSource.address().toHex())

  if (bar === null) {
    bar = createBar(block)
  }

  return bar as Bar
}

function createUser(address: Address, block: ethereum.Block): User {
  const user = new User(address.toHex())

  // Set relation to bar
  user.bar = dataSource.address().toHex()

  user.xTrams = BIG_DECIMAL_ZERO
  user.xTramsMinted = BIG_DECIMAL_ZERO
  user.xTramsBurned = BIG_DECIMAL_ZERO

  user.tramsStaked = BIG_DECIMAL_ZERO
  user.tramsStakedUSD = BIG_DECIMAL_ZERO

  user.tramsHarvested = BIG_DECIMAL_ZERO
  user.tramsHarvestedUSD = BIG_DECIMAL_ZERO

  // In/Out
  user.xTramsOut = BIG_DECIMAL_ZERO
  user.tramsOut = BIG_DECIMAL_ZERO
  user.usdOut = BIG_DECIMAL_ZERO

  user.xTramsIn = BIG_DECIMAL_ZERO
  user.tramsIn = BIG_DECIMAL_ZERO
  user.usdIn = BIG_DECIMAL_ZERO

  user.xTramsAge = BIG_DECIMAL_ZERO
  user.xTramsAgeDestroyed = BIG_DECIMAL_ZERO

  user.xTramsOffset = BIG_DECIMAL_ZERO
  user.tramsOffset = BIG_DECIMAL_ZERO
  user.usdOffset = BIG_DECIMAL_ZERO
  user.updatedAt = block.timestamp

  return user as User
}

function getUser(address: Address, block: ethereum.Block): User {
  let user = User.load(address.toHex())

  if (user === null) {
    user = createUser(address, block)
  }

  return user as User
}

function getHistory(block: ethereum.Block): History {
  const day = block.timestamp.toI32() / 86400

  const id = BigInt.fromI32(day).toString()

  let history = History.load(id)

  if (history === null) {
    const date = day * 86400
    history = new History(id)
    history.date = date
    history.timeframe = 'Day'
    history.tramsStaked = BIG_DECIMAL_ZERO
    history.tramsStakedUSD = BIG_DECIMAL_ZERO
    history.tramsHarvested = BIG_DECIMAL_ZERO
    history.tramsHarvestedUSD = BIG_DECIMAL_ZERO
    history.xTramsAge = BIG_DECIMAL_ZERO
    history.xTramsAgeDestroyed = BIG_DECIMAL_ZERO
    history.xTramsMinted = BIG_DECIMAL_ZERO
    history.xTramsBurned = BIG_DECIMAL_ZERO
    history.xTramsSupply = BIG_DECIMAL_ZERO
    history.ratio = BIG_DECIMAL_ZERO
  }

  return history as History
}

export function transfer(event: TransferEvent): void {
  // Convert to BigDecimal with 18 places, 1e18.
  const value = event.params.value.divDecimal(BIG_DECIMAL_1E18)

  // If value is zero, do nothing.
  if (value.equals(BIG_DECIMAL_ZERO)) {
    log.warning('Transfer zero value! Value: {} Tx: {}', [
      event.params.value.toString(),
      event.transaction.hash.toHex(),
    ])
    return
  }

  const bar = getBar(event.block)
  const barContract = BarContract.bind(TRAMS_BAR_ADDRESS)

  const tramsPrice = getTramsPrice()

  bar.totalSupply = barContract.totalSupply().divDecimal(BIG_DECIMAL_1E18)
  bar.tramsStaked = TramsTokenContract.bind(TRAMS_TOKEN_ADDRESS)
    .balanceOf(TRAMS_BAR_ADDRESS)
    .divDecimal(BIG_DECIMAL_1E18)
  bar.ratio = bar.tramsStaked.div(bar.totalSupply)

  const what = value.times(bar.ratio)

  // Minted xTrams
  if (event.params.from == ADDRESS_ZERO) {
    const user = getUser(event.params.to, event.block)

    log.info('{} minted {} xTrams in exchange for {} trams - tramsStaked before {} tramsStaked after {}', [
      event.params.to.toHex(),
      value.toString(),
      what.toString(),
      user.tramsStaked.toString(),
      user.tramsStaked.plus(what).toString(),
    ])

    if (user.xTrams == BIG_DECIMAL_ZERO) {
      log.info('{} entered the bar', [user.id])
      user.bar = bar.id
    }

    user.xTramsMinted = user.xTramsMinted.plus(value)

    const tramsStakedUSD = what.times(tramsPrice)

    user.tramsStaked = user.tramsStaked.plus(what)
    user.tramsStakedUSD = user.tramsStakedUSD.plus(tramsStakedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xTramsAge = days.times(user.xTrams)

    user.xTramsAge = user.xTramsAge.plus(xTramsAge)

    // Update last
    user.xTrams = user.xTrams.plus(value)

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXtrams = bar.xTramsMinted.minus(bar.xTramsBurned)
    bar.xTramsMinted = bar.xTramsMinted.plus(value)
    bar.xTramsAge = bar.xTramsAge.plus(barDays.times(barXtrams))
    bar.tramsStaked = bar.tramsStaked.plus(what)
    bar.tramsStakedUSD = bar.tramsStakedUSD.plus(tramsStakedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xTramsAge = bar.xTramsAge
    history.xTramsMinted = history.xTramsMinted.plus(value)
    history.xTramsSupply = bar.totalSupply
    history.tramsStaked = history.tramsStaked.plus(what)
    history.tramsStakedUSD = history.tramsStakedUSD.plus(tramsStakedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // Burned xTrams
  if (event.params.to == ADDRESS_ZERO) {
    log.info('{} burned {} xTrams', [event.params.from.toHex(), value.toString()])

    const user = getUser(event.params.from, event.block)

    user.xTramsBurned = user.xTramsBurned.plus(value)

    user.tramsHarvested = user.tramsHarvested.plus(what)

    const tramsHarvestedUSD = what.times(tramsPrice)

    user.tramsHarvestedUSD = user.tramsHarvestedUSD.plus(tramsHarvestedUSD)

    const days = event.block.timestamp.minus(user.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    const xTramsAge = days.times(user.xTrams)

    user.xTramsAge = user.xTramsAge.plus(xTramsAge)

    const xTramsAgeDestroyed = user.xTramsAge.div(user.xTrams).times(value)

    user.xTramsAgeDestroyed = user.xTramsAgeDestroyed.plus(xTramsAgeDestroyed)

    // Update xTrams last
    user.xTrams = user.xTrams.minus(value)

    if (user.xTrams == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar', [user.id])
      user.bar = null
    }

    user.updatedAt = event.block.timestamp

    user.save()

    const barDays = event.block.timestamp.minus(bar.updatedAt).divDecimal(BigDecimal.fromString('86400'))
    const barXtrams = bar.xTramsMinted.minus(bar.xTramsBurned)
    bar.xTramsBurned = bar.xTramsBurned.plus(value)
    bar.xTramsAge = bar.xTramsAge.plus(barDays.times(barXtrams)).minus(xTramsAgeDestroyed)
    bar.xTramsAgeDestroyed = bar.xTramsAgeDestroyed.plus(xTramsAgeDestroyed)
    bar.tramsHarvested = bar.tramsHarvested.plus(what)
    bar.tramsHarvestedUSD = bar.tramsHarvestedUSD.plus(tramsHarvestedUSD)
    bar.updatedAt = event.block.timestamp

    const history = getHistory(event.block)
    history.xTramsSupply = bar.totalSupply
    history.xTramsBurned = history.xTramsBurned.plus(value)
    history.xTramsAge = bar.xTramsAge
    history.xTramsAgeDestroyed = history.xTramsAgeDestroyed.plus(xTramsAgeDestroyed)
    history.tramsHarvested = history.tramsHarvested.plus(what)
    history.tramsHarvestedUSD = history.tramsHarvestedUSD.plus(tramsHarvestedUSD)
    history.ratio = bar.ratio
    history.save()
  }

  // If transfer from address to address and not known xTrams pools.
  if (event.params.from != ADDRESS_ZERO && event.params.to != ADDRESS_ZERO) {
    log.info('transfered {} xTrams from {} to {}', [
      value.toString(),
      event.params.from.toHex(),
      event.params.to.toHex(),
    ])

    const fromUser = getUser(event.params.from, event.block)

    const fromUserDays = event.block.timestamp.minus(fromUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    // Recalc xTrams age first
    fromUser.xTramsAge = fromUser.xTramsAge.plus(fromUserDays.times(fromUser.xTrams))
    // Calculate xTramsAge being transfered
    const xTramsAgeTranfered = fromUser.xTramsAge.div(fromUser.xTrams).times(value)
    // Subtract from xTramsAge
    fromUser.xTramsAge = fromUser.xTramsAge.minus(xTramsAgeTranfered)
    fromUser.updatedAt = event.block.timestamp

    fromUser.xTrams = fromUser.xTrams.minus(value)
    fromUser.xTramsOut = fromUser.xTramsOut.plus(value)
    fromUser.tramsOut = fromUser.tramsOut.plus(what)
    fromUser.usdOut = fromUser.usdOut.plus(what.times(tramsPrice))

    if (fromUser.xTrams == BIG_DECIMAL_ZERO) {
      log.info('{} left the bar by transfer OUT', [fromUser.id])
      fromUser.bar = null
    }

    fromUser.save()

    const toUser = getUser(event.params.to, event.block)

    if (toUser.bar === null) {
      log.info('{} entered the bar by transfer IN', [fromUser.id])
      toUser.bar = bar.id
    }

    // Recalculate xTrams age and add incoming xTramsAgeTransfered
    const toUserDays = event.block.timestamp.minus(toUser.updatedAt).divDecimal(BigDecimal.fromString('86400'))

    toUser.xTramsAge = toUser.xTramsAge.plus(toUserDays.times(toUser.xTrams)).plus(xTramsAgeTranfered)
    toUser.updatedAt = event.block.timestamp

    toUser.xTrams = toUser.xTrams.plus(value)
    toUser.xTramsIn = toUser.xTramsIn.plus(value)
    toUser.tramsIn = toUser.tramsIn.plus(what)
    toUser.usdIn = toUser.usdIn.plus(what.times(tramsPrice))

    const difference = toUser.xTramsIn.minus(toUser.xTramsOut).minus(toUser.xTramsOffset)

    // If difference of trams in - trams out - offset > 0, then add on the difference
    // in staked trams based on xTrams:Trams ratio at time of reciept.
    if (difference.gt(BIG_DECIMAL_ZERO)) {
      const trams = toUser.tramsIn.minus(toUser.tramsOut).minus(toUser.tramsOffset)
      const usd = toUser.usdIn.minus(toUser.usdOut).minus(toUser.usdOffset)

      log.info('{} recieved a transfer of {} xTrams from {}, trams value of transfer is {}', [
        toUser.id,
        value.toString(),
        fromUser.id,
        what.toString(),
      ])

      toUser.tramsStaked = toUser.tramsStaked.plus(trams)
      toUser.tramsStakedUSD = toUser.tramsStakedUSD.plus(usd)

      toUser.xTramsOffset = toUser.xTramsOffset.plus(difference)
      toUser.tramsOffset = toUser.tramsOffset.plus(trams)
      toUser.usdOffset = toUser.usdOffset.plus(usd)
    }

    toUser.save()
  }

  bar.save()
}
