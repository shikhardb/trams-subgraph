import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export const BIG_DECIMAL_1E6 = BigDecimal.fromString('1e6')

export const BIG_DECIMAL_1E12 = BigDecimal.fromString('1e12')

export const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18')

export const BIG_DECIMAL_ZERO = BigDecimal.fromString('0')

export const BIG_DECIMAL_ONE = BigDecimal.fromString('1')

export const BIG_INT_ZERO = BigInt.fromI32(0)

export const BIG_INT_ONE = BigInt.fromI32(1)

export const FACTORY_ADDRESS = Address.fromString('0xe73241B8451EC51d466c4175eD70586F0d6F97DA')

export const LOCKUP_BLOCK_NUMBER = BigInt.fromI32(10959148)

export const MASTER_CHEF_ADDRESS = Address.fromString('0xe219503aa238a7e5226989FBddE44eaDA56F0a66')

export const TRAMS_BAR_ADDRESS = Address.fromString('0x8798249c2e607446efb7ad49ec89dd1865ff4272')

export const TRAMS_MAKER_ADDRESS = Address.fromString('0x6684977bbed67e101bb80fc07fccfba655c0a64f')

export const TRAMS_TOKEN_ADDRESS = Address.fromString('0x4499eB0BB67F6e3ae8441fCbA12765a08794D2CC')

export const TRAMS_USDT_PAIR_ADDRESS = Address.fromString('0x680a025da7b1be2c204d7745e809919bce074026')

export const XTRAMS_USDC_PAIR_ADDRESS = Address.fromString('0xd597924b16cc1904d808285bc9044fd51ceeead7')

export const XTRAMS_WETH_PAIR_ADDRESS = Address.fromString('0x36e2fcccc59e5747ff63a03ea2e5c0c2c14911e7')
