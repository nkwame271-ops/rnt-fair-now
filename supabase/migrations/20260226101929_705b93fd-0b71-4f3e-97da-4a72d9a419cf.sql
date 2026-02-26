DROP POLICY "Users can update own pending kyc" ON kyc_verifications;
CREATE POLICY "Users can update own non-verified kyc"
  ON kyc_verifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'));