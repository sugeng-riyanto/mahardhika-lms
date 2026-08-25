import {
  Handshake, BarChart3, TrendingUp, Shield,
  AlertTriangle, Users, BookOpen, DollarSign, Lock,
} from 'lucide-react'
import { useSponsorshipProgrammes, useSponsorAggregate } from '@/api/hooks'

export function SponsorDashboard() {
  const { data: programmes, isLoading: programmesLoading } = useSponsorshipProgrammes()
  const { data: aggregate, isLoading: aggregateLoading } = useSponsorAggregate()

  const isLoading = programmesLoading || aggregateLoading

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Handshake className="text-blue-400" size={24} />
        <h1 className="page-title mb-0">Sponsor Dashboard</h1>
      </div>

      <p className="page-subtitle mb-4">Disclosure-controlled programme aggregates</p>

      {/* Privacy notice */}
      <div className="card mb-6 bg-blue-900/20 border border-blue-700/30">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-300">
              <strong>Privacy Notice:</strong> This dashboard shows aggregate programme data only.
              Individual learner data, canvas content, academic records, and safeguarding information
              are not accessible through this role. Data below meets minimum threshold requirements.
            </p>
            <p className="text-xs text-blue-400/60 mt-2">
              Per UU PDP and consent model: student-level data requires explicit parental consent
              and a valid data processing agreement. Sponsors receive only aggregate reports.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {aggregate && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-900/30">
                <Handshake size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aggregate.programme_count}</p>
                <p className="text-xs text-navy-400">Programmes</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-900/30">
                <Users size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aggregate.total_students}</p>
                <p className="text-xs text-navy-400">Beneficiaries</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-900/30">
                <BookOpen size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aggregate.total_courses}</p>
                <p className="text-xs text-navy-400">Courses</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-900/30">
                <DollarSign size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aggregate.fund_percentage}%</p>
                <p className="text-xs text-navy-400">Fund Used</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-900/30">
                <TrendingUp size={20} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aggregate.total_fund > 0 ? `Rp ${(aggregate.total_fund / 1_000_000).toFixed(0)}M` : '-'}</p>
                <p className="text-xs text-navy-400">Total Fund</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-900/30">
                <Lock size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{Object.values(aggregate.consent_summary || {}).reduce((a, b) => a + b, 0)}</p>
                <p className="text-xs text-navy-400">Consents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Programme Cards */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-blue-400" />
            Sponsored Programmes
          </h2>
          {programmes && programmes.length > 0 ? (
            <div className="space-y-4">
              {programmes.map((prog) => (
                <div key={prog.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{prog.name}</h3>
                      <p className="text-xs text-navy-500">{prog.organisation_name}</p>
                    </div>
                    <span className={`badge text-[10px] ${prog.is_active ? 'bg-green-900/30 text-green-400' : 'bg-navy-800 text-navy-400'}`}>
                      {prog.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-navy-800/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-white">{prog.total_students}</p>
                      <p className="text-[10px] text-navy-500">Students</p>
                    </div>
                    <div className="bg-navy-800/50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-cyan-400">{prog.total_courses}</p>
                      <p className="text-[10px] text-navy-500">Courses</p>
                    </div>
                    <div className="bg-navy-800/50 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${prog.completion_rate >= 70 ? 'text-green-400' : prog.completion_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {prog.completion_rate}%
                      </p>
                      <p className="text-[10px] text-navy-500">Completion</p>
                    </div>
                  </div>

                  {/* Average grade */}
                  {prog.average_grade > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-navy-400">Avg Grade:</span>
                      <div className="flex-1 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${prog.average_grade >= 80 ? 'bg-green-500' : prog.average_grade >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(prog.average_grade, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-white font-medium">{prog.average_grade}</span>
                    </div>
                  )}

                  {/* Fund bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-navy-400">Fund Utilisation</span>
                      <span className="text-navy-300">
                        Rp {(prog.fund_utilised / 1_000_000).toFixed(1)}M / Rp {(prog.fund_amount / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                    <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          prog.fund_percentage >= 90 ? 'bg-red-500' :
                          prog.fund_percentage >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(prog.fund_percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-navy-500 mt-0.5">{prog.fund_percentage}% utilised</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <Handshake className="mx-auto text-navy-600 mb-2" size={24} />
              <p className="text-sm text-navy-400">No sponsorship programmes assigned.</p>
              <p className="text-xs text-navy-500 mt-1">Contact your administrator to get access to sponsored programmes.</p>
            </div>
          )}
        </div>

        {/* Right column: Consent Summary + Fund Overview */}
        <div className="space-y-6">
          {/* Consent Summary */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield size={14} className="text-green-400" />
              Consent Summary (Aggregate)
            </h2>
            <p className="text-xs text-navy-500 mb-3">
              Number of users who have granted consent per purpose. Individual records are not accessible.
            </p>
            {aggregate?.consent_summary ? (
              <div className="space-y-2">
                {Object.entries(aggregate.consent_summary).map(([purpose, count]) => {
                  const purposeLabels: Record<string, string> = {
                    learning: 'Learning Data Processing',
                    analytics: 'Aggregate Analytics',
                    communication: 'Communication',
                    third_party: 'Third Party Sharing',
                  }
                  const purposeColours: Record<string, string> = {
                    learning: 'bg-cyan-500',
                    analytics: 'bg-purple-500',
                    communication: 'bg-green-500',
                    third_party: 'bg-orange-500',
                  }
                  return (
                    <div key={purpose} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${purposeColours[purpose] || 'bg-navy-500'}`} />
                      <span className="text-xs text-navy-300 flex-1">{purposeLabels[purpose] || purpose}</span>
                      <span className="text-xs text-white font-medium">{count}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-navy-500">No consent data available.</p>
            )}
          </div>

          {/* Fund Overview */}
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <DollarSign size={14} className="text-yellow-400" />
              Fund Overview
            </h2>
            {aggregate && aggregate.total_fund > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-navy-800/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-white">Rp {(aggregate.total_fund / 1_000_000).toFixed(0)}M</p>
                    <p className="text-[10px] text-navy-500">Total Allocated</p>
                  </div>
                  <div className="bg-navy-800/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-cyan-400">Rp {(aggregate.total_utilised / 1_000_000).toFixed(0)}M</p>
                    <p className="text-[10px] text-navy-500">Utilised</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      aggregate.fund_percentage >= 90 ? 'bg-red-500' :
                      aggregate.fund_percentage >= 70 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(aggregate.fund_percentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-navy-500">{aggregate.fund_percentage}% utilised</span>
                  <span className="text-[10px] text-navy-500">
                    Rp {((aggregate.total_fund - aggregate.total_utilised) / 1_000_000).toFixed(1)}M remaining
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-navy-500">No fund data available.</p>
            )}
          </div>

          {/* Data Access Notice */}
          <div className="card bg-navy-800/30 border border-navy-700/50">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-yellow-400 mb-1">Data Access Restrictions</p>
                <ul className="text-[10px] text-navy-400 space-y-1">
                  <li>Individual student names, emails, or IDs are not accessible</li>
                  <li>Canvas content, essays, and submissions are not accessible</li>
                  <li>Safeguarding reports are strictly confidential</li>
                  <li>Academic records show aggregate averages only</li>
                  <li>Access expires per sponsorship agreement terms</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
