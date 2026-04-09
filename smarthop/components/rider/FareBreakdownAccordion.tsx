'use client'

import { FarePrediction } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'

interface FareBreakdownAccordionProps {
  fareResult: FarePrediction
}

export default function FareBreakdownAccordion({ fareResult }: FareBreakdownAccordionProps) {
  const { explanation } = fareResult

  return (
    <Accordion type="single" collapsible className="bg-white rounded-2xl border shadow-sm">
      <AccordionItem value="fare-breakdown" className="border-0">
        <AccordionTrigger className="px-5 py-4 text-sm font-semibold text-slate-700 hover:no-underline hover:text-teal-700 transition-colors">
          Why is my fare {formatCurrency(fareResult.shared_fare)}?
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
          <div className="space-y-4">
            {/* Distance Impact */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Distance</span>
                <span className="text-slate-500">{explanation.distance_impact_pct.toFixed(0)}%</span>
              </div>
              <Progress value={explanation.distance_impact_pct} className="h-2" />
            </div>

            {/* Sharing Discount */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Sharing discount</span>
                <span className="text-green-600 font-semibold">-{explanation.sharing_discount_pct.toFixed(0)}%</span>
              </div>
              <Progress value={explanation.sharing_discount_pct} className="h-2 [&>div]:bg-green-500" />
            </div>

            {/* Time Surge */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Time surge</span>
                <span className="text-amber-600">{explanation.time_surge_pct.toFixed(0)}%</span>
              </div>
              <Progress value={explanation.time_surge_pct} className="h-2 [&>div]:bg-amber-500" />
            </div>

            {/* Human readable explanation */}
            {explanation.human_readable && (
              <p className="text-sm italic text-slate-500 pt-2 border-t">
                {explanation.human_readable}
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
