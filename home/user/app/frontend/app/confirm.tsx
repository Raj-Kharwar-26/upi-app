import { usePaymentStore } from '@/lib/payment-store';
import { formatCurrency } from '@/lib/upi';
import { useRouter } from 'expo-router';
import { PhoneIcon, HashIcon, CheckCircleIcon, CopyIcon, PhoneCallIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { qrData, amount, transactionId, mode, instruction } = usePaymentStore();
  const [copied, setCopied] = useState(false);

  if (!qrData || !amount || !transactionId || !instruction) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">No transaction data.</Text>
        <TouchableOpacity onPress={() => router.replace('/')} className="mt-4 rounded-xl bg-primary px-6 py-3">
          <Text className="font-semibold text-primary-foreground">Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const steps = instruction.split('\n').filter((s: string) => s.trim().length > 0);

  const handleCopy = async () => {
    const text = steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const handleDialUssd = () => {
    if (Platform.OS !== 'web') {
      Linking.openURL('tel:*99%23');
    }
  };

  const handleCallIvr = (number: string) => {
    if (Platform.OS !== 'web') {
      Linking.openURL(`tel:${number.replace(/-/g, '')}`);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }}
    >
      <View className="mt-6 items-center px-5">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircleIcon size={36} color={isDark ? '#818cf8' : '#6366f1'} />
        </View>
        <Text className="mt-4 text-xl font-bold text-foreground">Transaction Created</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Follow the steps below to complete payment
        </Text>
      </View>

      <View className="mt-6 mx-5 rounded-2xl bg-card p-4">
        <View className="flex-row items-center justify-between border-b border-border pb-3">
          <Text className="text-xs text-muted-foreground">To</Text>
          <Text className="text-sm font-semibold text-foreground">{qrData.payeeName}</Text>
        </View>
        <View className="flex-row items-center justify-between border-b border-border py-3">
          <Text className="text-xs text-muted-foreground">Amount</Text>
          <Text className="text-sm font-bold text-primary">{formatCurrency(amount)}</Text>
        </View>
        <View className="flex-row items-center justify-between border-b border-border py-3">
          <Text className="text-xs text-muted-foreground">Method</Text>
          <Text className="text-sm font-semibold text-foreground">
            {mode === 'ussd' ? 'USSD (*99#)' : 'IVR Call'}
          </Text>
        </View>
        <View className="flex-row items-center justify-between pt-3">
          <Text className="text-xs text-muted-foreground">Txn ID</Text>
          <Text className="text-xs font-mono text-muted-foreground">{transactionId.slice(0, 12)}...</Text>
        </View>
      </View>

      <View className="mt-6 mx-5">
        <View className="flex-row items-center gap-2 mb-3">
          {mode === 'ussd' ? (
            <HashIcon size={18} color={isDark ? '#818cf8' : '#6366f1'} />
          ) : (
            <PhoneIcon size={18} color={isDark ? '#818cf8' : '#6366f1'} />
          )}
          <Text className="text-sm font-semibold text-foreground">Step-by-Step Instructions</Text>
        </View>
        <View className="rounded-2xl bg-primary/5 border border-primary/20 p-4 gap-4">
          {steps.map((step: string, index: number) => (
            <View key={index} className="flex-row">
              <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                <Text className="text-xs font-bold text-primary">{index + 1}</Text>
              </View>
              <Text className="flex-1 text-sm leading-5 text-foreground">{step}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleCopy}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-3"
        >
          <CopyIcon size={16} color={isDark ? '#e2e8f0' : '#1e293b'} />
          <Text className="text-sm font-medium text-foreground">
            {copied ? 'Copied!' : 'Copy Instructions'}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'ussd' && (
        <View className="mt-4 px-5">
          <TouchableOpacity
            onPress={handleDialUssd}
            className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4"
            activeOpacity={0.8}
          >
            <HashIcon size={20} color="#ffffff" />
            <Text className="text-base font-bold text-primary-foreground">Dial *99#</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text className="mt-2 text-center text-xs text-muted-foreground">
              Open your phone dialer and dial *99#
            </Text>
          )}
        </View>
      )}

      {mode === 'ivr' && (
        <View className="mt-4 px-5 gap-3">
          <TouchableOpacity
            onPress={() => handleCallIvr('08045163666')}
            className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4"
            activeOpacity={0.8}
          >
            <PhoneCallIcon size={20} color="#ffffff" />
            <Text className="text-base font-bold text-primary-foreground">Call 080-4516-3666</Text>
          </TouchableOpacity>
          <Text className="text-center text-xs text-muted-foreground">
            SBI, HDFC, ICICI, Axis, IDFC First
          </Text>
          <TouchableOpacity
            onPress={() => handleCallIvr('6366200200')}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-primary py-4"
            activeOpacity={0.8}
          >
            <PhoneCallIcon size={20} color={isDark ? '#818cf8' : '#6366f1'} />
            <Text className="text-base font-bold text-primary">Call 6366-200-200</Text>
          </TouchableOpacity>
          <Text className="text-center text-xs text-muted-foreground">
            Canara Bank, PNB, NSDL
          </Text>
          {Platform.OS === 'web' && (
            <Text className="mt-1 text-center text-xs text-muted-foreground">
              Open your phone dialer and call the number for your bank
            </Text>
          )}
        </View>
      )}

      <View className="mt-6 px-5">
        <TouchableOpacity
          onPress={() => router.replace('/status')}
          className="items-center rounded-2xl border border-primary py-4"
          activeOpacity={0.8}
        >
          <Text className="text-base font-bold text-primary">Check Payment Status</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 px-5">
        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="items-center py-3"
        >
          <Text className="text-sm text-muted-foreground">Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
